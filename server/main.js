
const fs = require('fs');
const path = require('path');
const morgan = require('morgan');
const http = require('http');
const https = require('https');
const socketIO = require('socket.io');
const nopt = require("nopt");
const schedule = require('node-schedule');

const paths = require('./paths');
const logger = require('./runtime/logger');
const utils = require('./runtime/utils');
var events = require("./runtime/events").create();
const FUXA = require('./fuxa.js');
const runtime = require('./runtime');
const authJwt = require('./api/jwt-helper');

const express = require('express');
const app = express();

var server;
var settingsFile;

var startTime = new Date();

var knownOpts = {
    "help": Boolean,
    "port": Number,
    "userDir": [path]
};
var shortHands = {
    "?": ["--help"],
    "p": ["--port"],
    "u": ["--userDir"]
};

nopt.invalidHandler = function (k, v, t) {
    // TODO: console.log(k,v,t);
}

var parsedArgs = nopt(knownOpts, shortHands, process.argv, 2);

if (parsedArgs.help) {
    console.log("FUXA v" + FUXA.version());
    console.log("Usage: fuxa [-?] [--port PORT] [--userDir DIR]");
    console.log("");
    console.log("Options:");
    console.log("  -p, --port     PORT  port to listen on");
    console.log("  -u, --userDir  DIR   use specified user directory");
    console.log("  -?, --help           show this help");
    process.exit();
}

// Define directory
var rootDir = __dirname;
var workDir = path.resolve(process.cwd(), '_appdata');

if (process.env.userDir) {
    rootDir = process.env.userDir;
    workDir = path.resolve(process.env.userDir, '_appdata');
}

if (parsedArgs.userDir) {
    rootDir = parsedArgs.userDir;
    workDir = path.resolve(parsedArgs.userDir, '_appdata');
}

if (parsedArgs.env) {
    require('./envParams.js');
}

if (!fs.existsSync(workDir)) {
    fs.mkdirSync(workDir);
}

// Read app settings
var appSettingsFile = path.join(workDir, 'settings.js');
if (fs.existsSync(appSettingsFile)) {
    // _appdata/settings.js exists
    settingsFile = appSettingsFile;
} else {
    // Not exist, copy from code resource
    var defaultSettings = path.join(__dirname, 'settings.default.js');
    try {
        fs.copyFileSync(defaultSettings, appSettingsFile, fs.constants.COPYFILE_EXCL);
        logger.debug('settings.js default created successful!');
    } catch (err) {
        logger.error(err);
    }
    settingsFile = appSettingsFile;
}
try {
    // load settings and set some app variable
    var settings = require(settingsFile);
    // check new settings from default and merge if not defined
    var defSettings = require(path.join(__dirname, 'settings.default.js'));
    if (defSettings.version !== settings.version) {
        logger.warn("Settings are outdated. Missing fields have been merged from defaults. Consider reviewing 'settings.json'.");
        settings = utils.deepMerge(defSettings, settings);
    }

    settings.workDir = workDir;
    settings.appDir = __dirname;
    settings.packageDir = path.resolve(rootDir, '_pkg');
    settings.settingsFile = settingsFile;
    settings.environment = process.env.NODE_ENV || 'prod';
    settings.uploadFileDir = '_upload_files';
    settings.imagesFileDir = path.resolve(rootDir, '_images');
    settings.widgetsFileDir = path.resolve(rootDir, '_widgets');
    settings.reportsDir = path.resolve(rootDir, '_reports');
    settings.webcamSnapShotsDir = path.resolve(rootDir, settings.webcamSnapShotsDir);
} catch (err) {
    logger.error('Error loading settings file: ' + settingsFile)
    if (err.code == 'MODULE_NOT_FOUND') {
        if (err.toString().indexOf(settingsFile) === -1) {
            logger.error(err.toString());
        }
    } else {
        logger.error(err);
    }
    process.exit();
}
// Read user settings
try {
    var userSettingsFile = path.join(workDir, 'mysettings.json');
    settings.userSettingsFile = userSettingsFile;
    if (fs.existsSync(userSettingsFile)) {
        var mysettings = JSON.parse(fs.readFileSync(userSettingsFile, 'utf8'));
        if (mysettings.language) {
            settings.language = mysettings.language;
        }
        if (mysettings.uiPort) {
            settings.uiPort = mysettings.uiPort;
        }
        if (!utils.isNullOrUndefined(mysettings.secureEnabled)) {
            settings.secureEnabled = mysettings.secureEnabled;
            if (!settings.tokenExpiresIn) {
                settings.tokenExpiresIn = '1h';
            }
        }
        if (!utils.isNullOrUndefined(mysettings.secureOnlyEditor)) {
            settings.secureOnlyEditor = mysettings.secureOnlyEditor;
        }
        if (mysettings.tokenExpiresIn) {
            settings.tokenExpiresIn = mysettings.tokenExpiresIn;
        }
        if (mysettings.smtp) {
            settings.smtp = mysettings.smtp;
        }
        if (mysettings.daqstore) {
            settings.daqstore = mysettings.daqstore;
        }
        if (mysettings.alarms) {
            settings.alarms = mysettings.alarms;
        }
        if (!utils.isNullOrUndefined(mysettings.broadcastAll)) {
            settings.broadcastAll = mysettings.broadcastAll;
        }
        if (!utils.isNullOrUndefined(mysettings.logFull)) {
            settings.logFull = mysettings.logFull;
        }
        if (!utils.isNullOrUndefined(mysettings.userRole)) {
            settings.userRole = mysettings.userRole;
        }
    }
} catch (err) {
    logger.error('Error loading user settings file: ' + userSettingsFile)
}

// Check logger
if (!settings.logDir) {
    settings.logDir = path.resolve(rootDir, '_logs');
}
if (!fs.existsSync(settings.logDir)) {
    fs.mkdirSync(settings.logDir);
}

logger.init(settings);
const version = FUXA.version();
if (version.indexOf('beta') > 0) {
    logger.warn('FUXA V.' + version);
} else {
    logger.info('FUXA V.' + version);
}

// Check storage Database dir
if (!settings.dbDir) {
    settings.dbDir = path.resolve(rootDir, '_db');
}
if (!fs.existsSync(settings.dbDir)) {
    fs.mkdirSync(settings.dbDir);
}
// Check package folder
if (!fs.existsSync(settings.packageDir)) {
    fs.mkdirSync(settings.packageDir);
}
// Check reports folder
if (!fs.existsSync(settings.reportsDir)) {
    fs.mkdirSync(settings.reportsDir);
}
// Check upload file folder
settings.httpUploadFileStatic = 'resources';
settings.uploadFileDir = path.resolve(workDir, settings.uploadFileDir);
if (!fs.existsSync(settings.uploadFileDir)) {
    fs.mkdirSync(settings.uploadFileDir);
}
// Check images resources folder
if (!fs.existsSync(settings.imagesFileDir)) {
    fs.mkdirSync(settings.imagesFileDir);
}
// Check widgets resources folder
if (!fs.existsSync(settings.widgetsFileDir)) {
    fs.mkdirSync(settings.widgetsFileDir);
}
// Check webcam shots  folder
if (!fs.existsSync(settings.webcamSnapShotsDir)) {
    fs.mkdirSync(settings.webcamSnapShotsDir);
}

// Server settings
if (settings.https) {
    server = https.createServer(settings.https, app);
} else {
    server = http.createServer(app);
}
server.setMaxListeners(0);

const io = socketIO(server, {
    pingInterval: 60000,    // send ping interval
    pingTimeout: 120000,    // close connection if pong is not received
    allowEIO3: true,        //Whether to enable compatibility with Socket.IO v2 clients.
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: false
    }
});

// Check settings value
var www = path.resolve(__dirname, '../client/dist');
settings.httpStatic = settings.httpStatic || www;

if (parsedArgs.port !== undefined) {
    settings.uiPort = parsedArgs.port;
} else {
    if (settings.uiPort === undefined) {
        settings.uiPort = 1881;
    }
}
settings.uiHost = settings.uiHost || "0.0.0.0";

// Wait ending initialization
events.once('init-runtime-ok', function () {
    logger.info('FUXA init in  ' + utils.endTime(startTime) + 'ms.');
    startFuxa();
    initWebcamSnapshotCleanup();
});

// Init FUXA
try {
    FUXA.init(server, io, settings, logger, events);
} catch (err) {
    if (err.code == 'unsupported_version') {
        logger.error('Unsupported version of node.js:', process.version);
        logger.error('FUXA requires node.js v6 or later');
    } else if (err.code == 'not_built') {
        logger.error('FUXA has not been built. See README.md for details');
    } else {
        logger.error('Failed to start server:');
        if (err.stack) {
            logger.error(err.stack);
        } else {
            logger.error(err);
        }
    }
    process.exit(1);
}

// Http Server for client UI
const allowCrossDomain = function (req, res, next) {
    const origin = req.headers.origin;
    const allowedOrigins = settings.allowedOrigins || ["*"];

    const isOriginAllowed = (origin) => {
        if (!origin) return false;
        if (allowedOrigins.includes("*")) return true;

        // Convert wildcard-style strings to regex
        return allowedOrigins.some(pattern => {
            if (!pattern.includes("*")) return pattern === origin;

            // Escape dots and replace * with regex
            const regexPattern = new RegExp(
                "^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$"
            );
            return regexPattern.test(origin);
        });
    };

    if (isOriginAllowed(origin)) {
        res.header('Access-Control-Allow-Origin', origin || '*');
    }

    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'x-access-token, x-auth-user, Origin, Content-Type, Accept');


    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
};
app.use(allowCrossDomain);
app.use('/', express.static(settings.httpStatic));
app.use('/home', express.static(settings.httpStatic));
app.use('/home/:viewName', express.static(settings.httpStatic));
app.use('/lab', express.static(settings.httpStatic));
app.use('/editor', express.static(settings.httpStatic));
app.use('/device', express.static(settings.httpStatic));
app.use('/rodevice', express.static(settings.httpStatic));
app.use('/users', express.static(settings.httpStatic));
app.use('/view', express.static(settings.httpStatic));
app.use('/' + settings.httpUploadFileStatic, express.static(settings.uploadFileDir));
app.use('/_images', express.static(settings.imagesFileDir));
app.use('/_widgets', express.static(settings.widgetsFileDir));
app.use('/snapshots', express.static(settings.webcamSnapShotsDir))

var accessLogStream = fs.createWriteStream(settings.logDir + '/api.log', { flags: 'a' });
app.use(morgan('combined', {
    stream: accessLogStream,
    skip: function (req, res) { return res.statusCode < 400 }
}));

app.use(morgan('dev', {
    skip: function (req, res) {
        return res.statusCode < 400
    }, stream: process.stderr
}));

app.use(morgan('dev', {
    skip: function (req, res) {
        return res.statusCode >= 400
    }, stream: process.stdout
}));

// app.get('/', function (req, res) {
//     res.sendFile('/index.html');
//     try {
//         var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
//         logger.info("Client connected: " + ip);
//     } catch (err) {

//     }
// })

// set api to listen
// Moved to startFuxa() after Node-RED mounting

function getListenPath() {
    var port = settings.serverPort;
    if (port === undefined) {
        port = settings.uiPort;
    }

    var listenPath = 'http' + (settings.https ? 's' : '') + '://' +
        (settings.uiHost == '::' ? 'localhost' : (settings.uiHost == '0.0.0.0' ? '127.0.0.1' : settings.uiHost)) +
        ':' + port;
    if (settings.httpStatic) {
        listenPath += '/';
    }
    return listenPath;
}

// Start FUXA
function startFuxa() {
    FUXA.start().then(function () {
        const RED = require('node-red');
        // Init Node-RED
        const userDir = path.join(settings.workDir, 'node-red');
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }
        const redSettings = {
            httpAdminRoot: '/nodered',
            httpNodeRoot: '/nodered/api',
            userDir: userDir,
            nodesDir: [path.join(__dirname, 'node-red-contrib-fuxa')],
            flowFile: 'flows.json',
            editorTheme: {
                notifications: {
                    enabled: false
                },
                tours: {
                    enabled: false
                }
            },
            ui: {
                path: '/'
            },
            functionGlobalContext: {
                fuxa: {
                    runtime: runtime,
                    getTag: require('./runtime/devices').getTagValue,
                    setTag: require('./runtime/devices').setTagValue,
                    getDaq: require('./runtime/storage/daqstorage').getNodeValues,
                    getTagId: require('./runtime/devices').getTagId,
                    emit: events.emit.bind(events),
                    on: events.on.bind(events),
                    removeListener: events.removeListener.bind(events),
                    sendMessage: async (address, subject, message) => await runtime.notificatorMgr.sendMailMessage(null, address, subject, message, null, null),
                    getAlarms: async () => await runtime.alarmsMgr.getAlarmsValues(null, -1),
                    getHistoryAlarms: async (start, end) => { const query = { start: start, end: end }; return await runtime.alarmsMgr.getAlarmsHistory(query, -1); },
                    ackAlarm: async (alarmName, types) => {
                        const utils = require('./runtime/utils');
                        const separator = runtime.alarmsMgr.getIdSeparator();
                        if (alarmName.indexOf(separator) === -1 && !utils.isNullOrUndefined(types)) {
                            var result = [];
                            for(var i = 0; i < types.length; i++) {
                                const alarmId = `${alarmName}${separator}${types[i]}`;
                                result.push(await runtime.alarmsMgr.setAlarmAck(alarmId, null, -1));
                            }
                            return result;
                        } else {
                            return await runtime.alarmsMgr.setAlarmAck(alarmName, null, -1);
                        }
                    },
                    getScripts: async () => {
                        const scripts = await runtime.project.getScripts();
                        return scripts ? scripts.map(script => ({ id: script.id, name: script.name })) : [];
                    },
                    runScript: async (scriptName, params) => {
                        const scripts = await runtime.project.getScripts();
                        const script = scripts ? scripts.find(s => s.name === scriptName) : null;
                        if (script) {
                            return await runtime.scriptsMgr.runScript(script, null, params);
                        } else {
                            throw new Error(`Script with name ${scriptName} not found`);
                        }
                    }
                },
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
                serialport: require('serialport')
            }
        };
        RED.init(server, redSettings);
        
        // Create a middleware that allows dashboard routes without auth
        const allowDashboard = (req, res, next) => {
            // Allow dashboard and socket.io routes without authentication
            if (req.path.includes('/dashboard') || req.path.includes('/socket.io')) {
                return next();
            }
            // For other routes, check referer for iframe access or require auth
            const referer = req.headers.referer;
            if (referer) {
                // Allow iframe access from FUXA interface regardless of hostname/IP
                const fuxaInterfacePatterns = [
                    '/editor', '/viewer', '/lab', '/home', '/fuxa', '/flows', '/nodered'
                ];
                const isFromFuxaInterface = fuxaInterfacePatterns.some(pattern => referer.includes(pattern));
                if (isFromFuxaInterface) {
                    return next();
                }
            }
            return authJwt.requireAuth(req, res, next);
        };
        
        // Protect Node-RED routes with conditional auth
        app.use('/nodered', allowDashboard, RED.httpAdmin);
        app.use('/nodered/api', allowDashboard, RED.httpNode);
        
        // Public dashboard alias
        app.use('/dashboard', RED.httpNode);
        
        // Allow /flows route for Angular client-side routing
        // (Authentication is handled by Angular AuthGuard on the client side)
        
        RED.start();

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
            app.use('/', FUXA.httpApi);
        }

        if (settings.httpStatic) {
            server.on('error', function (err) {
                if (err.errno === 'EADDRINUSE') {
                    logger.error('server.port-in-use');
                    logger.error('server.unable-to-listen ', { listenpath: getListenPath() });
                } else {
                    if (err.stack) {
                        logger.error(err.stack);
                    } else {
                        logger.error('server.error ' + err);
                    }
                }
                process.exit(1);
            });
            server.listen(settings.uiPort, settings.uiHost, function () {
                settings.serverPort = server.address().port;
                process.title = 'FUXA';
                logger.info('WebServer is running ' + getListenPath());
            });
        } else {
            logger.info('server.headless-mode');
        }
    }).catch(function (err) {
        logger.error('server.failed-to-start');
        if (err) {
            if (err.stack) {
                logger.error(err.stack);
            } else {
                logger.error(err);
            }
        }
    });
}

const initWebcamSnapshotCleanup = () => {
    if (!settings.webcamSnapShotsCleanup) {
        return;
    }

    schedule.scheduleJob('0 1 * * *', cleanupSnapShotsFiles);
    logger.info('Scheduled webcam snapshot cleanup at 01:00 daily.');
};

/**
 * Cleanup Snapshots Files
 * @description  start on '0 1 * * *'
 */
const cleanupSnapShotsFiles = async () => {
    const { webcamSnapShotsCleanup, webcamSnapShotsDir, webcamSnapShotsRetain } = settings;

    if (!webcamSnapShotsCleanup) {
        return;
    }

    try {
        const now = Date.now();
        const retentionMillis = webcamSnapShotsRetain * 24 * 60 * 60 * 1000;
        const files = await fs.promises.readdir(webcamSnapShotsDir);
        let deletedCount = 0;

        for (const file of files) {
            const filePath = path.join(webcamSnapShotsDir, file);
            try {
                const stat = await fs.promises.stat(filePath);
                if (stat.mtime && (now - stat.mtimeMs > retentionMillis)) {
                    await fs.promises.unlink(filePath);
                    deletedCount++;
                }
            } catch (fileErr) {
                logger.error(`Failed to process snapshot file: ${filePath}`, fileErr);
            }
        }

        logger.info(`Snapshot cleanup completed. ${deletedCount} old file(s) deleted.`);
    } catch (err) {
        logger.error('Error during webcam snapshot cleanup', err);
    }
};

// Don't wait any more
setTimeout(() => {
    events.emit('init-runtime-ok');
}, 60000);

process.on('uncaughtException', function (err) {
    if (err.stack) {
        logger.error(err.stack);
    } else {
        logger.error(err);
    }
});

process.on('SIGINT', function () {
    FUXA.stop().then(function () {
        process.exit();
    });
    logger.info('FUXA end!');
    process.exit();
});
