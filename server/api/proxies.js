/**
 * Generic HTTP reverse proxies configured in settings.js:
 *
 *   proxies: [
 *       { path: '/gis', target: 'https://gis.example.com/gis' },
 *       { path: '/weather', target: 'http://10.0.0.5:8080', headers: { 'x-api-key': '...' }, timeout: 10000 }
 *   ]
 *
 * A request to <BASE_PATH><path>/rest?query is forwarded to <target>/rest?query
 * (the target path is used as prefix). Method, query, body and headers are forwarded,
 * except hop-by-hop headers and the FUXA credentials (cookie, authorization, x-access-token).
 */
'use strict';

const http = require('http');
const https = require('https');

// headers that must not be forwarded between connections (RFC 7230 6.1) + Host
const HOP_BY_HOP = ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'proxy-connection',
    'te', 'trailer', 'transfer-encoding', 'upgrade', 'host'];
// FUXA credentials must never leak to an external server
const CREDENTIALS = ['cookie', 'authorization', 'x-access-token'];
// routes served by FUXA itself
const RESERVED = ['/api', '/api-docs', '/socket.io', '/resources', '/_images', '/_widgets', '/snapshots'];

const DEFAULT_TIMEOUT = 30000;

function filterHeaders(headers, excluded) {
    const result = {};
    for (const [key, value] of Object.entries(headers || {})) {
        if (!excluded.includes(key.toLowerCase())) {
            result[key] = value;
        }
    }
    return result;
}

function parseConfig(cfg) {
    if (!cfg || typeof cfg.path !== 'string' || !cfg.path.startsWith('/')) {
        throw new Error('"path" must be a string starting with "/"');
    }
    const routePath = cfg.path.replace(/\/+$/, '');
    if (!routePath) {
        throw new Error('"path" cannot be the root "/"');
    }
    if (RESERVED.some(r => routePath === r || routePath.startsWith(r + '/'))) {
        throw new Error(`"${routePath}" is reserved by FUXA`);
    }
    let target;
    try {
        target = new URL(cfg.target);
    } catch (err) {
        throw new Error('"target" must be a valid URL');
    }
    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
        throw new Error('"target" must be an http:// or https:// URL');
    }
    return {
        routePath,
        target,
        targetPath: target.pathname.replace(/\/+$/, ''),
        client: target.protocol === 'https:' ? https : http,
        headers: cfg.headers || {},
        timeout: Number(cfg.timeout) > 0 ? Number(cfg.timeout) : DEFAULT_TIMEOUT,
        rejectUnauthorized: cfg.rejectUnauthorized !== false
    };
}

function createHandler(proxy, label, logger) {
    return (req, res) => {
        const headers = filterHeaders(req.headers, [...HOP_BY_HOP, ...CREDENTIALS]);
        const remote = req.socket && req.socket.remoteAddress;
        headers['x-forwarded-for'] = req.headers['x-forwarded-for'] ? `${req.headers['x-forwarded-for']}, ${remote}` : remote;
        headers['x-forwarded-host'] = req.headers.host;
        headers['x-forwarded-proto'] = req.protocol;
        Object.assign(headers, proxy.headers);

        const upstreamReq = proxy.client.request({
            protocol: proxy.target.protocol,
            hostname: proxy.target.hostname,
            port: proxy.target.port || undefined,
            method: req.method,
            path: proxy.targetPath + req.url,       // req.url is relative to the mount path and keeps the query
            headers,
            timeout: proxy.timeout,
            rejectUnauthorized: proxy.rejectUnauthorized
        }, (upstreamRes) => {
            res.writeHead(upstreamRes.statusCode, filterHeaders(upstreamRes.headers, HOP_BY_HOP));
            upstreamRes.pipe(res);
        });

        upstreamReq.on('timeout', () => upstreamReq.destroy(new Error(`timeout after ${proxy.timeout} ms`)));
        upstreamReq.on('error', (err) => {
            logger.error(`${label}: ${req.method} ${req.originalUrl} failed: ${err.message}`);
            if (!res.headersSent) {
                res.status(502).send('Bad Gateway');
            } else {
                res.destroy();
            }
        });
        res.on('close', () => {
            if (!res.writableFinished) {
                upstreamReq.destroy();             // client went away
            }
        });
        req.pipe(upstreamReq);
    };
}

/**
 * Mount the configured proxies. Must be called before any body parser,
 * so the request body is still available to be streamed to the target.
 */
function mount(app, proxies, basePath, logger) {
    if (!proxies) {
        return;
    }
    if (!Array.isArray(proxies)) {
        logger.error('proxies: setting must be an array, ignored');
        return;
    }
    proxies.forEach((cfg, index) => {
        const label = `proxy ${cfg && cfg.path ? cfg.path : '#' + index}`;
        let proxy;
        try {
            proxy = parseConfig(cfg);
        } catch (err) {
            logger.error(`${label}: ignored, ${err.message}`);
            return;
        }
        app.use(basePath + proxy.routePath, createHandler(proxy, label, logger));
        logger.info(`${label}: ${basePath + proxy.routePath} -> ${proxy.target.origin}${proxy.targetPath}`);
    });
}

module.exports = { mount };
