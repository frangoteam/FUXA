
const fs = require('fs');
const path = require('path');
const morgan = require('morgan');
const http = require('http');
const https = require('https');
const socketIO = require('socket.io');
const nopt = require("nopt");

const paths = require('./paths');
const logger = require('./runtime/logger');
const utils = require('./runtime/utils');
var events = require("./runtime/events").create();

const FUXA = require('./fuxa.js');

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
    "?":["--help"],
    "p":["--port"],
    "u":["--userDir"]
};

nopt.invalidHandler = function(k,v,t) {
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

if(process.env.userDir){
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
    settings.workDir = workDir;
    settings.appDir = __dirname;
    settings.packageDir = path.resolve(rootDir, '_pkg');
    settings.settingsFile = settingsFile;
    settings.environment = process.env.NODE_ENV || 'prod';
    settings.uploadFileDir = '_upload_files';
    settings.imagesFileDir = path.resolve(rootDir, '_images');
    settings.widgetsFileDir = path.resolve(rootDir, '_widgets');
    settings.reportsDir = path.resolve(rootDir, '_reports');

    // check new settings from default and merge if not defined
    var defSettings = require(path.join(__dirname, 'settings.default.js'));
    if (defSettings.version !== settings.version) {
        logger.warn("Settings aren't up to date! Please check 'settings.json'.");
        // settings = Object.assign(defSettings, settings);
    }
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

// Server settings
if (settings.https) {
    server = https.createServer(settings.https, function (req, res) { app(req, res); });
} else {
    server = http.createServer(function (req, res) { app(req, res); });
}
server.setMaxListeners(0);

const io = socketIO(server);

// Check settings value
var www = path.resolve(__dirname, '../client/dist');
settings.httpStatic = settings.httpStatic || www;

if (parsedArgs.port !== undefined){
    settings.uiPort = parsedArgs.port;
} else {
    if (settings.uiPort === undefined){
        settings.uiPort = 1881;
    }
}
settings.uiHost = settings.uiHost || "0.0.0.0";

// Wait ending initialization
events.once('init-runtime-ok', function () {
    logger.info('FUXA init in  ' + utils.endTime(startTime) + 'ms.');
    startFuxa();
});

// Init FUXA
try {
    FUXA.init(server, io, settings, logger, events);
} catch(err) {
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
var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'x-access-token, x-auth-user, Origin, Content-Type, Accept');

    next();
    try {
        var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        // logger.info("Client: " + ip, false);
    } catch (err) {

    }
}
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

var accessLogStream = fs.createWriteStream(settings.logDir + '/api.log', {flags: 'a'});
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
if (settings.disableServer !== false) {
    app.use('/', FUXA.httpApi);
}

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
    FUXA.stop().then(function() {
        process.exit();
    });
    logger.info('FUXA end!');
    process.exit();
});
