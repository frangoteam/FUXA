
const fs = require('fs');
const path = require('path');
const morgan = require('morgan');
const http = require('http');
const https = require('https');
const socketIO = require('socket.io');

const paths = require('./paths');
const logger = require('./runtime/logger');

const FUXA = require("./fuxa.js");

const express = require('express');
const app = express();

var server;
var settingsFile;

// Define work directory in AppData
var workDir = path.resolve(__dirname, "_appdata");
if (!fs.existsSync(workDir)) {
    fs.mkdirSync(workDir);
}

// Read app settings 
var userSettingsFile = path.join(workDir, "settings.js");
if (fs.existsSync(userSettingsFile)) {
    // _appdata/settings.js exists
    settingsFile = userSettingsFile;
} else {
    // Not exist, copy from code resource
    var defaultSettings = path.join(__dirname, "settings.default.js");
    var settingsStat = fs.statSync(defaultSettings);
    fs.copyFileSync(defaultSettings, userSettingsFile, (err) => {
        if (err) return logger.error(err);
        logger.debug("settings.js default created successful!")
    });
    settingsFile = userSettingsFile;
}
try {
    // load settings and set some app variable
    var settings = require(settingsFile);
    settings.workDir = workDir;
    settings.appDir = __dirname;
    settings.settingsFile = settingsFile;
    settings.environment = process.env.NODE_ENV || 'prod';
    // check new settings from default and merge if not defined
    var defSettings = require(path.join(__dirname, "settings.default.js"));
    if (defSettings.version !== settings.version) {
        logger.warn("Settings aren't up to date! Please check 'settings.json'.");
        // settings = Object.assign(defSettings, settings);
    }
} catch (err) {
    logger.error("Error loading settings file: " + settingsFile)
    if (err.code == 'MODULE_NOT_FOUND') {
        if (err.toString().indexOf(settingsFile) === -1) {
            logger.error(err.toString());
        }
    } else {
        logger.error(err);
    }
    process.exit();
}

// Check logger
if (!settings.logDir) {
    settings.logDir = path.resolve(__dirname, "_logs"); 
}
if (!fs.existsSync(settings.logDir)) {
    fs.mkdirSync(settings.logDir);
}

logger.init(settings.logDir);
const version = FUXA.version();
if (version.indexOf('beta') > 0) {
    logger.warn("FUXA V." + version);
} else {
    logger.info("FUXA V." + version);
}

// Check storage Database dir
if (!settings.dbDir) {
    settings.dbDir = path.resolve(__dirname, "_db");
}
if (!fs.existsSync(settings.dbDir)) {
    fs.mkdirSync(settings.dbDir);
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
var www = path.resolve(__dirname, "../client/dist");
settings.httpStatic = settings.httpStatic || www;

if (settings.uiPort === undefined) {
    settings.uiPort = 1880;
}
settings.uiHost = settings.uiHost || "localhost"; //"0.0.0.0";

// Init application
try {
    FUXA.init(server, io, settings, logger);
} catch(err) {
    if (err.code == "unsupported_version") {
        logger.error("Unsupported version of node.js:", process.version);
        logger.error("FUXA requires node.js v6 or later");
    } else if (err.code == "not_built") {
        logger.error("FUXA has not been built. See README.md for details");
    } else {
        logger.error("Failed to start server:");
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
app.use("/", express.static(settings.httpStatic));
app.use("/home", express.static(settings.httpStatic));
app.use("/lab", express.static(settings.httpStatic));
app.use("/editor", express.static(settings.httpStatic));
app.use("/device", express.static(settings.httpStatic));
app.use("/users", express.static(settings.httpStatic));
app.use("/view", express.static(settings.httpStatic));

var accessLogStream = fs.createWriteStream(settings.logDir + '/api.log', {flags: 'a'});
app.use(morgan('combined', { stream: accessLogStream }));

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
    app.use("/", FUXA.httpApi);
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
        listenPath += "/";
    }
    return listenPath;
}

FUXA.start().then(function () {
    if (settings.httpStatic) {
        server.on('error', function (err) {
            if (err.errno === "EADDRINUSE") {
                logger.error("server.port-in-use");
                logger.error("server.unable-to-listen ", { listenpath: getListenPath() });
            } else {
                if (err.stack) {
                    logger.error(err.stack);
                } else {
                    logger.error("server.error " + err);
                }
            }
            process.exit(1);
        });
        server.listen(settings.uiPort, settings.uiHost, function () {
            settings.serverPort = server.address().port;
            process.title = 'FUXA';
            logger.info("server.now-running " + getListenPath());
        });
    } else {
        logger.info("server.headless-mode");
    }
}).catch(function (err) {
    logger.error("server.failed-to-start");
    if (err.stack) {
        logger.error(err.stack);
    } else {
        logger.error(err);
    }
});

process.on('uncaughtException', function (err) {
    if (err.stack) {
        logger.error(err.stack);
    } else {
        logger.error(err);
    }
    process.exit(1);
});

process.on('SIGINT', function () {
    FUXA.stop().then(function() {
        process.exit();
    });
    logger.info("FUXA END");// + FUXA.getVersion());
    process.exit();
});
