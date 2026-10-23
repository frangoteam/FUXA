/**
 * 'iothttp': generic HTTP(S) driver for boards and devices (ESP32, etc.).
 *
 * Read: requests are grouped per endpoint, values are extracted with a JSON path
 * and an optional request body is sent (POST /json).
 * Write: POST/PUT/PATCH/DELETE with a json-key/json-template/raw/form payload.
 * Auth: none | bearer | basic | apiKey | login (dynamic token/cookie).
 *
 * Config (device.property):
 *   address/baseUrl, timeout, verifyTls, method, headers, query, readBody
 *   authMode: 'none'|'bearer'|'basic'|'apiKey'|'login'
 *   -- static: authToken, authUser, authPass, authHeader, authQuery, authKey
 *   -- login:  loginUrl, loginMethod, loginBody, loginHeaders, tokenFrom,
 *              tokenPath, cookieName, tokenInject, tokenHeader, tokenQuery,
 *              tokenBodyKey, tokenRefreshMinutes
 * Placeholders accepted in readBody/headers/query/write.template:
 *   {token} {username} {password}
 */
'use strict';
const axios = require('axios');
const utils = require('../../utils');
const deviceUtils = require('../device-utils');

function HTTPclient(_data, _logger, _events, _runtime) {
    var runtime = _runtime;
    var data = _data;
    var logger = _logger;
    var events = _events;
    var self = this;
    var working = false;
    var connected = false;
    var lastStatus = '';
    var varsValue = [];
    var lastTimestampRequest = 0;
    var lastTimestampValue = 0;
    var overloading = 0;
    var readGroups = [];
    var groupSnapshots = {};   // per-endpoint snapshot (Firebase patch)
    var streams = [];          // open SSE streams
    var streamTimers = [];     // reconnect timers
    var stopped = false;

    // Token/cookie obtained in 'login' mode
    var currentToken = null;
    var currentCookie = null;
    var tokenFetchedAt = 0;

    // ---- helpers ----------------------------------------------------------
    function parseJson(value) {
        if (!value) return {};
        if (typeof value === 'object') return value;
        try { return JSON.parse(value); } catch (_e) { return {}; }
    }

    function baseUrl() {
        return (data.property && (data.property.address || data.property.baseUrl)) || '';
    }

    function authConfig(property) {
        const auth = parseJson(property.auth);
        return {
            mode: auth.mode || property.authMode || 'none',
            token: auth.token || property.authToken,
            user: auth.user || property.authUser,
            pass: auth.pass || property.authPass,
            headerName: auth.headerName || property.authHeader,
            queryName: auth.queryName || property.authQuery,
            apiKey: auth.apiKey || property.authKey,
            // login
            loginUrl: auth.loginUrl || property.loginUrl,
            loginMethod: auth.loginMethod || property.loginMethod || 'POST',
            loginBody: auth.loginBody || property.loginBody,
            loginHeaders: auth.loginHeaders || property.loginHeaders,
            tokenFrom: auth.tokenFrom || property.tokenFrom || 'json',
            tokenPath: auth.tokenPath || property.tokenPath,
            cookieName: auth.cookieName || property.cookieName,
            tokenInject: auth.tokenInject || property.tokenInject || 'headerBearer',
            tokenHeader: auth.tokenHeader || property.tokenHeader,
            tokenQuery: auth.tokenQuery || property.tokenQuery,
            tokenBodyKey: auth.tokenBodyKey || property.tokenBodyKey || 'authToken',
            refreshMinutes: Number(auth.refreshMinutes || property.tokenRefreshMinutes || 0),
        };
    }

    function applyPlaceholders(value) {
        const auth = authConfig(data.property || {});
        const map = {
            '{token}': currentToken || auth.token || '',
            '{username}': auth.user || '',
            '{password}': auth.pass || '',
        };
        if (typeof value === 'string') {
            let out = value;
            for (const k in map) {
                out = out.split(k).join(map[k]);
            }
            return out;
        }
        if (Array.isArray(value)) return value.map(applyPlaceholders);
        if (value && typeof value === 'object') {
            const out = {};
            for (const k in value) out[k] = applyPlaceholders(value[k]);
            return out;
        }
        return value;
    }

    function authHeaders(property) {
        const auth = authConfig(property);
        const headers = {};
        if (auth.mode === 'bearer' && auth.token) {
            headers['Authorization'] = `Bearer ${auth.token}`;
        } else if (auth.mode === 'basic' && (auth.user || auth.pass)) {
            const token = Buffer.from(`${auth.user || ''}:${auth.pass || ''}`).toString('base64');
            headers['Authorization'] = `Basic ${token}`;
        } else if (auth.mode === 'apiKey' && auth.headerName && auth.apiKey) {
            headers[auth.headerName] = auth.apiKey;
        } else if (auth.mode === 'login' && currentToken) {
            if (auth.tokenInject === 'headerBearer') {
                headers['Authorization'] = `Bearer ${currentToken}`;
            } else if (auth.tokenInject === 'header') {
                headers[auth.tokenHeader || 'X-Token'] = currentToken;
            }
        }
        if (auth.mode === 'login' && currentCookie) {
            headers['Cookie'] = currentCookie;
        }
        return headers;
    }

    function buildHeaders(tag) {
        const property = data.property || {};
        const opt = parseJson(tag && tag.options);
        const write = opt.write || {};
        return Object.assign({},
            applyPlaceholders(parseJson(property.headers)),
            authHeaders(property),
            applyPlaceholders(parseJson(write.headers)));
    }

    function buildParams(tag) {
        const property = data.property || {};
        const opt = parseJson(tag && tag.options);
        const write = opt.write || {};
        const auth = authConfig(property);
        const params = Object.assign({}, applyPlaceholders(parseJson(property.query)), applyPlaceholders(parseJson(write.query)));
        if (auth.mode === 'apiKey' && auth.queryName && auth.apiKey) {
            params[auth.queryName] = auth.apiKey;
        } else if (auth.mode === 'login' && auth.tokenInject === 'query' && currentToken) {
            params[auth.tokenQuery || 'token'] = currentToken;
        }
        return params;
    }

    function buildReadBody(tag) {
        const property = data.property || {};
        const opt = parseJson(tag && tag.options);
        const auth = authConfig(property);
        const body = Object.assign({}, applyPlaceholders(parseJson(property.readBody)), applyPlaceholders(parseJson(opt.readBody)));
        if (auth.mode === 'login' && auth.tokenInject === 'body' && currentToken) {
            body[auth.tokenBodyKey || 'authToken'] = currentToken;
        }
        return body;
    }

    function resolveUrl(path) {
        const p = String(path || '');
        if (/^https?:\/\//i.test(p)) return p;
        const base = baseUrl().replace(/\/$/, '');
        return base + (p.startsWith('/') ? p : '/' + p);
    }

    function getByPath(obj, path) {
        if (!path) return obj;
        let p = String(path).trim();
        // Accepts simple JSONPath notation: $.a.b, a.b, a[0].b, a["x"].b
        p = p.replace(/^\$\.?/, '');
        p = p.replace(/\[(\d+)\]/g, '.$1')
             .replace(/\["([^"]+)"\]/g, '.$1')
             .replace(/\['([^']+)'\]/g, '.$1');
        return p.split('.').filter((part) => part !== '').reduce((acc, part) => (acc === null || acc === undefined) ? undefined : acc[part], obj);
    }

    function extractValue(body, tag) {
        if (tag.memaddress) return getByPath(body, tag.memaddress);
        if (body && typeof body === 'object' && !Array.isArray(body) && 'value' in body) return body.value;
        return body;
    }

    function axiosConfig(extra) {
        const property = data.property || {};
        const cfg = Object.assign({ timeout: Number(property.timeout) || 5000 }, extra);
        if (property.verifyTls === false || property.verifyTls === 'false') {
            cfg.httpsAgent = new (require('https').Agent)({ rejectUnauthorized: false });
        }
        return cfg;
    }

    // ---- login / dynamic token ----------------------------------------------
    function tokenExpired(auth) {
        if (!currentToken && !currentCookie) return true;
        if (auth.refreshMinutes > 0 && (Date.now() - tokenFetchedAt) > auth.refreshMinutes * 60000) return true;
        return false;
    }

    async function ensureToken(force) {
        const auth = authConfig(data.property || {});
        if (auth.mode !== 'login') return;
        if (!force && !tokenExpired(auth)) return;
        const url = resolveUrl(auth.loginUrl || '/auth');
        const headers = Object.assign({ 'Content-Type': 'application/json' }, applyPlaceholders(parseJson(auth.loginHeaders)));
        let body = auth.loginBody || '{"username":"{username}","password":"{password}"}';
        body = applyPlaceholders(body);
        try {
            const res = await axios.request(axiosConfig({
                method: String(auth.loginMethod || 'POST').toUpperCase(),
                url,
                headers,
                data: body,
            }));
            // extract the token
            if (auth.tokenFrom === 'cookie') {
                const setCookie = res.headers && res.headers['set-cookie'];
                const list = Array.isArray(setCookie) ? setCookie : (setCookie ? [setCookie] : []);
                const name = auth.cookieName || 'authToken';
                const found = list.find((c) => String(c).startsWith(name + '='));
                if (found) {
                    currentCookie = String(found).split(';')[0];
                    currentToken = currentCookie.split('=')[1];
                }
            } else if (auth.tokenFrom === 'header') {
                currentToken = res.headers ? res.headers[(auth.tokenHeader || 'authorization')] : null;
            } else if (auth.tokenFrom === 'text') {
                currentToken = typeof res.data === 'string' ? res.data.trim() : null;
            } else {
                currentToken = auth.tokenPath ? getByPath(res.data, auth.tokenPath) : (res.data && (res.data.access_token || res.data.token || res.data.authToken || res.data.accessToken));
            }
            tokenFetchedAt = Date.now();
            logger.info(`'${data.name}' [iothttp] login ok (${auth.tokenFrom}${auth.tokenPath ? ':' + auth.tokenPath : ''})`, true);
        } catch (err) {
            logger.error(`'${data.name}' [iothttp] login error: ${err.message}`);
            throw err;
        }
    }

    // Request with auth; on 401 (login mode) renew the token and retry once.
    async function requestWithAuth(makeConfig) {
        const auth = authConfig(data.property || {});
        await ensureToken(false);
        try {
            return await axios.request(axiosConfig(makeConfig()));
        } catch (err) {
            const status = err && err.response ? err.response.status : null;
            if (status === 401 && auth.mode === 'login') {
                await ensureToken(true);
                return axios.request(axiosConfig(makeConfig()));
            }
            throw err;
        }
    }

    // ---- SSE streaming (Firebase text/event-stream and similar) -------------
    function isStreamMode() {
        const p = data.property || {};
        return p.stream === true || p.stream === 'true' || p.readMode === 'sse';
    }

    function setAtPath(obj, path, value) {
        const parts = String(path || '/').split('/').filter(Boolean);
        if (parts.length === 0) return value;
        let cur = obj;
        for (let i = 0; i < parts.length - 1; i++) {
            if (cur[parts[i]] === undefined || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
            cur = cur[parts[i]];
        }
        cur[parts[parts.length - 1]] = value;
        return obj;
    }

    function onSseBlock(group, block) {
        const lines = block.split('\n');
        const dataLines = [];
        for (const line of lines) {
            if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
        }
        if (!dataLines.length) return; // comment/keep-alive
        const raw = dataLines.join('\n');
        let payload;
        try { payload = JSON.parse(raw); } catch (_e) { return; }
        // Firebase: { path, data } (partial patch/put) -> keep the snapshot
        if (payload && typeof payload === 'object' && 'path' in payload && 'data' in payload) {
            groupSnapshots[group.key] = setAtPath(groupSnapshots[group.key] || {}, payload.path, payload.data);
            payload = groupSnapshots[group.key];
        } else {
            groupSnapshots[group.key] = payload;
        }
        _applyGroupValues(group, payload).then(() => {
            lastTimestampValue = new Date().getTime();
            _emitValues(varsValue);
            if (lastStatus !== 'connect-ok') _emitStatus('connect-ok');
            connected = true;
        }).catch((e) => logger.warn(`'${data.name}' [iothttp] stream apply: ${e.message}`));
    }

    async function startGroupStream(group) {
        if (stopped) return;
        try {
            try { await ensureToken(false); } catch (_e) { /* login falhou, tenta mesmo assim */ }
            const reqMethod = String(group.method || 'GET').toUpperCase();
            const readBody = buildReadBody(group.tags[0]);
            const cfg = axiosConfig({
                method: reqMethod,
                url: resolveUrl(group.path),
                headers: Object.assign({ Accept: 'text/event-stream' }, buildHeaders(group.tags[0])),
                params: buildParams(group.tags[0]),
                responseType: 'stream',
            });
            if (!['GET', 'HEAD'].includes(reqMethod) && Object.keys(readBody).length > 0) cfg.data = readBody;
            const res = await axios.request(cfg);
            const stream = res.data;
            streams.push({ group, stream });
            let buffer = '';
            stream.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
                let idx;
                while ((idx = buffer.indexOf('\n\n')) >= 0) {
                    const block = buffer.slice(0, idx);
                    buffer = buffer.slice(idx + 2);
                    onSseBlock(group, block);
                }
            });
            stream.on('error', (err) => {
                logger.error(`'${data.name}' [iothttp] stream ${group.path} error: ${err.message}`);
                _emitStatus('connect-error');
                scheduleReconnect(group);
            });
            stream.on('end', () => scheduleReconnect(group));
            logger.info(`'${data.name}' [iothttp] SSE stream open on ${group.path}`, true);
        } catch (err) {
            logger.error(`'${data.name}' [iothttp] stream ${group.path} failed: ${err.message}`);
            _emitStatus('connect-error');
            scheduleReconnect(group);
        }
    }

    function scheduleReconnect(group) {
        if (stopped) return;
        const t = setTimeout(() => startGroupStream(group), 3000);
        streamTimers.push(t);
    }

    function startStreams() {
        for (const group of readGroups) startGroupStream(group);
    }

    function stopStreams() {
        stopped = true;
        for (const t of streamTimers) clearTimeout(t);
        streamTimers = [];
        for (const s of streams) {
            try { if (s.stream && typeof s.stream.destroy === 'function') s.stream.destroy(); } catch (_e) { /* ignore */ }
        }
        streams = [];
    }

    // ---- lifecycle --------------------------------------------------------
    this.connect = function () {
        return new Promise(function (resolve, reject) {
            stopped = false;
            if (baseUrl() || (data.property && data.property.getTags)) {
                connected = true;
                _emitStatus('connect-ok');
                resolve();
            } else {
                connected = false;
                _emitStatus('connect-failed');
                logger.error(`'${data.name}' [iothttp] base URL is not configured!`);
                reject();
            }
        });
    }

    this.disconnect = function () {
        return new Promise(function (resolve) {
            stopStreams();
            connected = false;
            _emitStatus('connect-off');
            _clearVarsValue();
            resolve();
        });
    }

    this.isConnected = function () { return connected; }
    this.bindAddDaq = function (fnc) { this.addDaq = fnc; }
    this.addDaq = null;
    this.lastReadTimestamp = () => lastTimestampValue;

    this.load = function (_data) {
        varsValue = [];
        data = JSON.parse(JSON.stringify(_data));
        try {
            const groups = {};
            for (const id in data.tags) {
                const tag = data.tags[id];
                const opt = parseJson(tag.options);
                const method = (opt.readMethod || (data.property && data.property.method) || 'GET').toUpperCase();
                const path = tag.address || id;
                const key = `${method} ${path}`;
                if (!groups[key]) groups[key] = { key, method, path, tags: [] };
                groups[key].tags.push(tag);
            }
            readGroups = Object.values(groups);
            groupSnapshots = {};
            logger.info(`'${data.name}' [iothttp] data loaded (${Object.keys(data.tags).length} tags, ${readGroups.length} endpoints)`, true);
            // In streaming mode, (re)open the SSE streams.
            if (isStreamMode()) {
                stopStreams();
                stopped = false;
                startStreams();
            }
        } catch (err) {
            logger.error(`'${data.name}' [iothttp] load error! ${err}`);
        }
    }

    this.getValue = function (id) {
        if (varsValue[id]) return { id: id, value: varsValue[id].value, ts: lastTimestampValue };
        return null;
    }
    this.getValues = function () { return varsValue; }
    this.getStatus = function () { return lastStatus; }
    this.getTagProperty = function (id) {
        if (data.tags[id]) return { id: id, name: data.tags[id].name, type: data.tags[id].type, format: data.tags[id].format };
        return null;
    }
    this.getTagDaqSettings = (tagId) => (data.tags[tagId] ? data.tags[tagId].daq : null);
    this.setTagDaqSettings = (tagId, settings) => {
        if (data.tags[tagId]) utils.mergeObjectsValues(data.tags[tagId].daq, settings);
    };

    // ---- write (commands) ---------------------------------------------------
    this.setValue = async function (tagId, value) {
        const tag = data.tags && data.tags[tagId];
        if (!tag) return false;
        const opt = parseJson(tag.options);
        const write = opt.write || {};
        const method = String(write.method || opt.writeMethod || 'POST').toUpperCase();
        if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
            logger.error(`'${data.name}' [iothttp] invalid write method: ${method}`);
            return false;
        }
        const path = write.path || opt.writePath || tag.address;
        const mode = write.mode || opt.bodyMode || 'json-key';
        const contentType = write.contentType || 'application/json';
        const key = write.key || opt.writeKey || tag.name || tagId;

        let body;
        if (mode === 'raw') {
            body = value;
        } else if (mode === 'form') {
            const form = new URLSearchParams();
            form.append(key, value);
            body = form.toString();
        } else if (mode === 'json-template') {
            const tpl = write.template || '{"value": {value}}';
            body = applyPlaceholders(tpl).replace(/\{value\}/g, typeof value === 'string' ? `"${value}"` : JSON.stringify(value));
        } else {
            body = {};
            body[key] = value;
        }

        try {
            await requestWithAuth(() => ({
                method,
                url: resolveUrl(path),
                headers: Object.assign({}, buildHeaders(tag), { 'Content-Type': contentType }),
                params: buildParams(tag),
                data: body,
            }));
            lastTimestampRequest = new Date().getTime();
            logger.info(`'${data.name}' [iothttp] setValue(${key}) = ${JSON.stringify(value)}`, true, true);
            return true;
        } catch (err) {
            logger.error(`'${data.name}' [iothttp] setValue error: ${err.message}`);
            return false;
        }
    }

    // ---- polling ----------------------------------------------------------
    this.polling = async function () {
        // Streaming mode (SSE): no HTTP polling, just keep the streams alive.
        if (isStreamMode()) {
            if (streams.length === 0 && !stopped) startStreams();
            return;
        }
        if (!_checkWorking(true)) {
            _emitStatus('connect-busy');
            return;
        }
        try {
            let anySuccess = false;
            for (const group of readGroups) {
                try {
                    const reqMethod = String(group.method || 'GET').toUpperCase();
                    const res = await requestWithAuth(() => {
                        const readBody = buildReadBody(group.tags[0]);
                        const cfg = {
                            method: reqMethod,
                            url: resolveUrl(group.path),
                            headers: buildHeaders(group.tags[0]),
                            params: buildParams(group.tags[0]),
                        };
                        if (!['GET', 'HEAD'].includes(reqMethod) && Object.keys(readBody).length > 0) {
                            cfg.data = readBody;
                        }
                        return cfg;
                    });
                    lastTimestampRequest = new Date().getTime();
                    anySuccess = true;
                    await _applyGroupValues(group, res.data);
                } catch (err) {
                    logger.error(`'${data.name}' [iothttp] read ${group.path} error: ${err.message}`);
                }
            }
            if (anySuccess) {
                lastTimestampValue = new Date().getTime();
                _emitValues(varsValue);
                if (lastStatus !== 'connect-ok') _emitStatus('connect-ok');
                connected = true;
            } else if (lastTimestampRequest && (lastTimestampRequest + (data.polling * 3)) < new Date().getTime()) {
                connected = false;
                _emitStatus('connect-error');
            }
            _checkWorking(false);
        } catch (reason) {
            logger.error(`'${data.name}' [iothttp] polling error! ${reason}`);
            _checkWorking(false);
        }
    }

    async function _applyGroupValues(group, body) {
        const timestamp = new Date().getTime();
        const changed = {};
        for (const tag of group.tags) {
            let value = extractValue(body, tag);
            if (utils.isNullOrUndefined(value)) continue;
            const prev = varsValue[tag.id] ? varsValue[tag.id].value : null;
            let composed = value;
            try {
                composed = await deviceUtils.tagValueCompose(value, prev, tag, runtime);
            } catch (_e) { composed = value; }
            varsValue[tag.id] = {
                id: tag.id,
                value: composed,
                rawValue: value,
                type: tag.type,
                daq: tag.daq,
                changed: prev !== composed,
                timestamp,
            };
            if (self.addDaq && deviceUtils.tagDaqToSave(varsValue[tag.id], timestamp)) {
                changed[tag.id] = varsValue[tag.id];
            }
        }
        if (self.addDaq && !utils.isEmptyObject(changed)) {
            self.addDaq(changed, data.name, data.id);
        }
    }

    var _clearVarsValue = function () {
        for (var id in varsValue) varsValue[id].value = null;
        _emitValues(varsValue);
    }
    var _emitStatus = function (status) {
        lastStatus = status;
        events.emit('device-status:changed', { id: data.id, status: status });
    }
    var _emitValues = function (values) {
        events.emit('device-value:changed', { id: data.id, values: values });
    }
    var _checkWorking = function (check) {
        if (check && working) {
            overloading++;
            logger.warn(`'${data.name}' [iothttp] working overload! ${overloading}`);
            if (overloading >= 3) connected = false;
            else return false;
        }
        working = check;
        overloading = 0;
        return true;
    }
}

module.exports = {
    init: function () { },
    create: function (data, logger, events, runtime) {
        return new HTTPclient(data, logger, events, runtime);
    },
    // Run a single read (used by the "Test read" button in the UI).
    testRequest: async function ({ property = {}, tag = {} } = {}) {
        const parseJson = (v) => {
            if (!v) return {};
            if (typeof v === 'object') return v;
            try { return JSON.parse(v); } catch (_e) { return {}; }
        };
        const getByPath = (obj, path) => {
            if (!path) return obj;
            let p = String(path).trim().replace(/^\$\.?/, '');
            p = p.replace(/\[(\d+)\]/g, '.$1').replace(/\["([^"]+)"\]/g, '.$1').replace(/\['([^']+)'\]/g, '.$1');
            return p.split('.').filter((s) => s !== '').reduce((acc, part) => (acc === null || acc === undefined) ? undefined : acc[part], obj);
        };
        try {
            const base = String(property.address || property.baseUrl || '').replace(/\/$/, '');
            const path = String(tag.address || '');
            const url = /^https?:\/\//i.test(path) ? path : base + (path.startsWith('/') ? path : '/' + path);
            const headers = Object.assign({}, parseJson(property.headers));
            const params = Object.assign({}, parseJson(property.query));
            const mode = property.authMode || 'none';
            if (mode === 'bearer' && property.authToken) {
                headers['Authorization'] = `Bearer ${property.authToken}`;
            } else if (mode === 'basic' && (property.authUser || property.authPass)) {
                headers['Authorization'] = 'Basic ' + Buffer.from(`${property.authUser || ''}:${property.authPass || ''}`).toString('base64');
            } else if (mode === 'apiKey' && property.authKey) {
                if (property.authHeader) headers[property.authHeader] = property.authKey;
                if (property.authQuery) params[property.authQuery] = property.authKey;
            }
            const method = String(tag.readMethod || property.method || 'GET').toUpperCase();
            const cfg = { method, url, headers, params, timeout: Number(property.timeout) || 5000 };
            const body = parseJson(property.readBody);
            if (!['GET', 'HEAD'].includes(method) && Object.keys(body).length > 0) cfg.data = body;
            if (property.verifyTls === false || property.verifyTls === 'false') {
                cfg.httpsAgent = new (require('https').Agent)({ rejectUnauthorized: false });
            }
            const res = await axios.request(cfg);
            const value = tag.memaddress ? getByPath(res.data, tag.memaddress) : res.data;
            return { ok: true, status: res.status, value, data: res.data };
        } catch (err) {
            return { ok: false, status: err && err.response ? err.response.status : null, error: err.message, data: err && err.response ? err.response.data : null };
        }
    }
};
