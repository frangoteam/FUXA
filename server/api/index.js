/**
 * 'api/project': API server initialization and general GET/POST
 */

const fs = require('fs');
var express = require('express');
var morgan = require('morgan');
var bodyParser = require('body-parser');
const authJwt = require('./jwt-helper');
const rateLimit = require("express-rate-limit");

var prjApi = require('./projects');
var authApi = require('./auth');
var usersApi = require('./users');
var alarmsApi = require('./alarms');
var pluginsApi = require('./plugins');
var diagnoseApi = require('./diagnose');
var scriptsApi = require('./scripts');
var resourcesApi = require('./resources');
var daqApi = require('./daq');
var commandApi = require('./command');

var apiApp;
var server;
var runtime;
var editor;

function init(_server, _runtime) {
    server = _server;
    runtime = _runtime;
    return new Promise(function (resolve, reject) {
        if (runtime.settings.disableServer !== false) {
            apiApp = express();
            apiApp.use(morgan(['combined', 'common', 'dev', 'short', 'tiny'].
                includes(runtime.settings.logApiLevel) ? runtime.settings.logApiLevel : 'combined'));

            var maxApiRequestSize = runtime.settings.apiMaxLength || '35mb';
            apiApp.use(bodyParser.json({limit:maxApiRequestSize}));
            apiApp.use(bodyParser.urlencoded({limit:maxApiRequestSize,extended:true}));
            authJwt.init(runtime.settings.secureEnabled, runtime.settings.secretCode, runtime.settings.tokenExpiresIn);
            prjApi.init(runtime, authJwt.verifyToken, verifyGroups);
            apiApp.use(prjApi.app());
            usersApi.init(runtime, authJwt.verifyToken, verifyGroups);
            apiApp.use(usersApi.app());
            alarmsApi.init(runtime, authJwt.verifyToken, verifyGroups);
            apiApp.use(alarmsApi.app());
            authApi.init(runtime, authJwt.secretCode, authJwt.tokenExpiresIn);
            apiApp.use(authApi.app());
            pluginsApi.init(runtime, authJwt.verifyToken, verifyGroups);
            apiApp.use(pluginsApi.app());
            diagnoseApi.init(runtime, authJwt.verifyToken, verifyGroups);
            apiApp.use(diagnoseApi.app());
            daqApi.init(runtime, authJwt.verifyToken, verifyGroups);
            apiApp.use(daqApi.app());
            scriptsApi.init(runtime, authJwt.verifyToken, verifyGroups);
            apiApp.use(scriptsApi.app());
            resourcesApi.init(runtime, authJwt.verifyToken, verifyGroups);
            apiApp.use(resourcesApi.app());
            commandApi.init(runtime, authJwt.verifyToken, verifyGroups);
            apiApp.use(commandApi.app());

            const limiter = rateLimit({
                windowMs: 5 * 60 * 1000, // 5 minutes
                max: 100 // limit each IP to 100 requests per windowMs
            });

            //  apply to all requests
            apiApp.use(limiter);

            /**
             * GET Server setting data
             */
            apiApp.get('/api/settings', function (req, res) {
                if (runtime.settings) {
                    let tosend = JSON.parse(JSON.stringify(runtime.settings));
                    delete tosend.secretCode;
                    if (tosend.smtp) {
                        delete tosend.smtp.password;
                    }
                    // res.header("Access-Control-Allow-Origin", "*");
                    // res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
                    res.json(tosend);
                } else {
                    res.status(404).end();
                    runtime.logger.error('api get settings: Value Not Found!');
                }
            });

            /**
             * POST Server user settings
             */
            apiApp.post("/api/settings", authJwt.verifyToken, function(req, res, next) {
                var groups = verifyGroups(req);
                if (res.statusCode === 403) {
                    runtime.logger.error("api post settings: Tocken Expired");
                } else if (authJwt.adminGroups.indexOf(groups) === -1 ) {
                    res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                    runtime.logger.error("api post settings: Unauthorized");
                } else {
                    try {
                        if (req.body.smtp && !req.body.smtp.password && runtime.settings.smtp && runtime.settings.smtp.password) {
                            req.body.smtp.password = runtime.settings.smtp.password;
                        }
                        fs.writeFileSync(runtime.settings.userSettingsFile, JSON.stringify(req.body, null, 4));
                        mergeUserSettings(req.body);
                        runtime.restart(true).then(function(result) {
                            res.end();
                        });
                    } catch (err) {
                        res.status(400).json({ error: "unexpected_error", message: err });
                        runtime.logger.error("api post settings: " + err);
                    }
                }
            });

            /**
             * GET Heartbeat to check token
             */
            apiApp.post('/api/heartbeat', authJwt.verifyToken, function (req, res) {
                if (!runtime.settings.secureEnabled) {
                    res.end();
                } else if (res.statusCode === 403) {
                    runtime.logger.error("api post heartbeat: Tocken Expired");
                } else if (req.body.params) {
                    const token = authJwt.getNewToken(req.headers)
                    if (token) {
                        res.status(200).json({
                            message: 'tokenRefresh',
                            token: token
                        });
                    } else {
                        res.end();
                    }
                } else {
                    res.end();
                }
            });
            runtime.logger.info('api: init successful!', true);
        } else {
        }
        resolve();
    });
}

function mergeUserSettings(settings) {
    if (settings.language) {
        runtime.settings.language = settings.language;
    }
    runtime.settings.broadcastAll = settings.broadcastAll;
    runtime.settings.secureEnabled = settings.secureEnabled;
    runtime.settings.logFull = settings.logFull;
    if (settings.secureEnabled) {
        runtime.settings.tokenExpiresIn = settings.tokenExpiresIn;
    }
    if (settings.smtp) {
        runtime.settings.smtp = settings.smtp;
    }
    if (settings.daqstore) {
        runtime.settings.daqstore = settings.daqstore;
    }
    if (settings.alarms) {
        runtime.settings.alarms = settings.alarms;
    }
}

function verifyGroups(req) {
    return (runtime.settings && runtime.settings.secureEnabled) ? ((req.tokenExpired) ? 0 : req.userGroups) : authJwt.adminGroups[0];
}

function start() {
}

function stop() {
}

module.exports = {
    init: init,
    start: start,
    stop: stop,

    get apiApp() { return apiApp; },
    get server() { return server; },
    get authJwt() { return authJwt; }
};
