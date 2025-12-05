// server/integrations/node-red/index.js
// Optional Node-RED integration: mount only if the package is installed.

const fs = require('fs');
const path = require('path');

function tryRequireNodeRed() {
    try {
        // Fast check whether the module is resolvable
        require.resolve('node-red');
        // Load it only after resolve succeeds
        // (keeps main process clean when not installed)
        // eslint-disable-next-line global-require
        return require('node-red');
    } catch {
        return null;
    }
}

async function mountNodeRedIfInstalled({ app, server, settings, runtime, logger, authJwt, events }) {
    const RED = tryRequireNodeRed();
    if (!RED) {
        logger.info('[Node-RED] Package not installed. Skipping Node-RED initialization.');
        // Do not register any /nodered routes; default 404 is fine.
        return;
    }

    // Prepare Node-RED userDir for flows and settings
    const userDir = path.join(settings.workDir, 'node-red');
    if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
    }

    // Minimal Node-RED settings; extend only what is really needed
    const redSettings = {
        httpAdminRoot: '/nodered/',
        // Let Node-RED own the HTTP space at root; dashboard will live under /dashboard
        httpNodeRoot: '/',
        userDir,
        nodesDir: [path.join(__dirname, 'node-red-contrib-fuxa')],
        flowFile: 'flows.json',
        editorTheme: {
            notifications: { enabled: false },
            tours: { enabled: false },
        },
        // Dashboard will be exposed at /dashboard/...
        ui: { path: '/dashboard' },
        // Values used by FlowFuse dashboard's ui_base.js for layout saves
        // These mirror the FUXA HTTP bind address so Node-RED can call its own /nodered/flows API
        uiHost: settings.uiHost,
        uiPort: settings.uiPort,
        functionGlobalContext: {
            // Expose essential FUXA runtime helpers
            fuxa: {
                runtime,
                getTag: require(path.join(settings.appDir, 'runtime/devices')).getTagValue,
                setTag: require(path.join(settings.appDir, 'runtime/devices')).setTagValue,
                getDaq: require(path.join(settings.appDir, 'runtime/storage/daqstorage')).getNodeValues,
                getTagId: require(path.join(settings.appDir, 'runtime/devices')).getTagId,
                getHistoricalTags: require(path.join(settings.appDir, 'runtime/devices')).getHistoricalTags,
                emit: events.emit.bind(events),
                on: events.on.bind(events),
                removeListener: events.removeListener.bind(events),
                sendMessage: async (address, subject, message) =>
                    await runtime.notificatorMgr.sendMailMessage(null, address, subject, message, null, null),
                getAlarms: async () => await runtime.alarmsMgr.getAlarmsValues(null, -1),
                getHistoryAlarms: async (start, end) => {
                    const query = { start, end };
                    return runtime.alarmsMgr.getAlarmsHistory(query, -1);
                },
                ackAlarm: async (alarmName, types) => {
                    const utils = require(path.join(settings.appDir, 'runtime/utils'));
                    const sep = runtime.alarmsMgr.getIdSeparator();
                    if (alarmName.indexOf(sep) === -1 && !utils.isNullOrUndefined(types)) {
                        const results = [];
                        for (const t of types) {
                            const alarmId = `${alarmName}${sep}${t}`;
                            results.push(await runtime.alarmsMgr.setAlarmAck(alarmId, null, -1));
                        }
                        return results;
                    }
                    return runtime.alarmsMgr.setAlarmAck(alarmName, null, -1);
                },
                getScripts: async () => {
                    const scripts = await runtime.project.getScripts();
                    return scripts ? scripts.map(s => ({ id: s.id, name: s.name })) : [];
                },
                runScript: async (scriptName, params) => {
                    const scripts = await runtime.project.getScripts();
                    const script = scripts?.find(s => s.name === scriptName);
                    if (!script) throw new Error(`Script '${scriptName}' not found`);
                    return runtime.scriptsMgr.runScript(script, null, params);
                },
            },

            // Common Node.js stdlib modules handy in flows
            fs: require('fs').promises,
            fsSync: require('fs'),
            path: require('path'),
            util: require('util'),
            os: require('os'),
            child_process: require('child_process'),
            http: require('http'),
            https: require('https'),
            net: require('net'),
            dgram: require('dgram'),
            dns: require('dns'),
            url: require('url'),
            querystring: require('querystring'),
            crypto: require('crypto'),
            zlib: require('zlib'),
            stream: require('stream'),
            events: require('events'),
            buffer: require('buffer'),
            sqlite3: require('sqlite3'),
            serialport: require('serialport'),
        },
    };

    // Initialize Node-RED on the existing HTTP server (must be done before server.listen)
    RED.init(server, redSettings);

    // Allow dashboard UI, its admin APIs and socket.io without extra JWT; enforce auth for the rest
    const allowDashboard = (req, res, next) => {
            const url = req.originalUrl || req.url || req.path;

            // Public dashboard UI and its HTTP APIs (served from httpNodeRoot/ui.path)
            if (url.includes('/dashboard') || url.includes('/socket.io')) return next();

            // Node-RED dashboard admin APIs used by the layout editor under /nodered/dashboard/...
            if (url.startsWith('/nodered/dashboard/')) return next();

            // Internal Node-RED flows APIs used by FlowFuse layout saves and deployments
            if (url === '/nodered/flows' || url === '/nodered/flows/') return next();
            if (url === '/nodered/flows/state' || url === '/nodered/flows/state/') return next();
            if (url === '/nodered/flows/deploy' || url === '/nodered/flows/deploy/') return next();

            const referer = req.headers.referer;
            if (referer) {
                const ok = ['/editor', '/viewer', '/lab', '/home', '/fuxa', '/flows', '/nodered']
                        .some(p => referer.includes(p));
                if (ok) return next();
            }
            return authJwt.requireAuth(req, res, next);
    };

    // Mount Node-RED admin/editor under /nodered; HTTP nodes (including dashboard)
    // are served from httpNodeRoot ('/') so they appear at /dashboard/... etc.
    app.use('/nodered', allowDashboard, RED.httpAdmin);
    app.use('/', allowDashboard, RED.httpNode);

    await RED.start();

    RED.httpAdmin.get('/fuxa/devices', function(req, res) {
        const devices = runtime.project.getDevices();
        const result = [];
        for (const id in devices) {
            const device = devices[id];
            const tags = [];
            for (const tagId in device.tags) {
                tags.push({ id: tagId, name: device.tags[tagId].name });
            }
            result.push({ id: device.id, name: device.name, tags });
        }
        res.json(result);
    });

    RED.httpAdmin.get('/fuxa/scripts', async function(req, res) {
        try {
            const scripts = await runtime.project.getScripts();
            const result = scripts ? scripts.map(script => ({ id: script.id, name: script.name })) : [];
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    RED.httpAdmin.get('/fuxa/views', async function(req, res) {
        try {
            const project = await runtime.project.getProject();
            const result = project && project.hmi && project.hmi.views ?
                project.hmi.views.map(view => ({ id: view.id, name: view.name })) : [];
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    RED.httpAdmin.get('/fuxa/alarms', async function(req, res) {
        try {
            const alarms = await runtime.project.getAlarms();
            const result = alarms ?
                alarms.map(alarm => ({ id: alarm.id, name: alarm.name })) : [];
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // set api to listen (moved here to avoid rate limiting Node-RED routes)
    if (settings.disableServer !== false) {
        // Catch-all route for SPA - serve Angular index.html for client routes
        // Exclude API routes and static assets
        app.get('*', (req, res, next) => {
            // Skip API routes and static assets
            if (req.path.startsWith('/api/') ||
                req.path.includes('.') ||
                req.path.startsWith('/nodered') ||
                req.path.startsWith('/dashboard')) {
                return next();
            }
            res.sendFile(path.join(settings.httpStatic, 'index.html'));
        });
    }

    logger.info('[Node-RED] Started at /nodered');
}

module.exports = { mountNodeRedIfInstalled };