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
        httpAdminRoot: '/nodered',
        httpNodeRoot: '/nodered/api',
        userDir,
        flowFile: 'flows.json',
        editorTheme: {
            notifications: { enabled: false },
            tours: { enabled: false },
        },
        ui: { path: '/' },
        functionGlobalContext: {
            // Expose essential FUXA runtime helpers
            fuxa: {
                runtime,
                getTag: require('../../runtime/devices').getTagValue,
                setTag: require('../../runtime/devices').setTagValue,
                getDaq: require('../../runtime/storage/daqstorage').getNodeValues,
                getTagId: require('../../runtime/devices').getTagId,
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
                    const utils = require('../../runtime/utils');
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

    // Allow dashboard and socket.io without auth; enforce auth for the rest
    const allowDashboard = (req, res, next) => {
        if (req.path.includes('/dashboard') || req.path.includes('/socket.io')) return next();
        const referer = req.headers.referer;
        if (referer) {
            const ok = ['/editor', '/viewer', '/lab', '/home', '/fuxa', '/flows', '/nodered']
                .some(p => referer.includes(p));
            if (ok) return next();
        }
        return authJwt.requireAuth(req, res, next);
    };

    // Mount Node-RED routes under /nodered
    app.use('/nodered', allowDashboard, RED.httpAdmin);
    app.use('/nodered', allowDashboard, RED.httpNode);

    await RED.start();
    logger.info('[Node-RED] Started at /nodered');
}

module.exports = { mountNodeRedIfInstalled };
