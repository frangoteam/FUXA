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
var apiKeysApi = require('./apikeys');
var alarmsApi = require('./alarms');
var pluginsApi = require('./plugins');
var diagnoseApi = require('./diagnose');
var scriptsApi = require('./scripts');
var resourcesApi = require('./resources');
var daqApi = require('./daq');
var schedulerApi = require('./scheduler');
var commandApi = require('./command');
const reports = require('../dist/reports.service');
const reportsApi = new reports.ReportsApiService();
const verifyApiOrToken = require('./apikeys/verify-api-or-token');

const version = '1.0.0';

var apiApp;
var server;
var runtime;

function init(_server, _runtime) {
    server = _server;
    runtime = _runtime;

    return new Promise(function (resolve, reject) {
        if (runtime.settings.disableServer !== false) {
            apiApp = express();
            apiApp.use(morgan(['combined', 'common', 'dev', 'short', 'tiny'].
                includes(runtime.settings.logApiLevel) ? runtime.settings.logApiLevel : 'combined'));

            var maxApiRequestSize = runtime.settings.apiMaxLength || '100mb';
            apiApp.use(bodyParser.json({limit:maxApiRequestSize}));
            apiApp.use(bodyParser.urlencoded({limit:maxApiRequestSize, extended: true}));
            authJwt.init(runtime.settings.secureEnabled, runtime.settings.secretCode, runtime.settings.tokenExpiresIn);
            const authMiddleware = verifyApiOrToken(runtime);
            prjApi.init(runtime, authMiddleware, verifyGroups);
            apiApp.use(prjApi.app());
            usersApi.init(runtime, authMiddleware, verifyGroups);
            apiApp.use(usersApi.app());
            alarmsApi.init(runtime, authMiddleware, verifyGroups);
            apiApp.use(alarmsApi.app());
            authApi.init(runtime, authJwt.secretCode, authJwt.tokenExpiresIn);
            apiApp.use(authApi.app());
            pluginsApi.init(runtime, authMiddleware, verifyGroups);
            apiApp.use(pluginsApi.app());
            diagnoseApi.init(runtime, authMiddleware, verifyGroups);
            apiApp.use(diagnoseApi.app());
            daqApi.init(runtime, authMiddleware, verifyGroups);
            apiApp.use(daqApi.app());
            schedulerApi.init(runtime, authMiddleware, verifyGroups);
            apiApp.use(schedulerApi.app());
            scriptsApi.init(runtime, authMiddleware, verifyGroups);
            apiApp.use(scriptsApi.app());
            resourcesApi.init(runtime, authMiddleware, verifyGroups);
            apiApp.use(resourcesApi.app());
            commandApi.init(runtime, authMiddleware, verifyGroups);
            apiApp.use(commandApi.app());
            reportsApi.init(runtime, authMiddleware, verifyGroups);
            apiApp.use(reportsApi.app());
            apiKeysApi.init(runtime, authMiddleware, verifyGroups);
            apiApp.use(apiKeysApi.app());

            const limiter = rateLimit({
                windowMs: 5 * 60 * 1000, // 5 minutes
                max: 100 // limit each IP to 100 requests per windowMs
            });

            //  apply to all requests
            apiApp.use(limiter);

            apiApp.use((err, req, res, next) => {
                if (err?.type === 'entity.too.large') {
                    return res.status(413).json({
                        message: `The submitted content exceeds the maximum allowed size (${maxApiRequestSize})`
                    });
                }
                next(err);
            });

            /**
             * GET Server setting data
             */
            apiApp.get('/api/version', function (req, res) {
                res.json(version);
            });

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
            apiApp.post("/api/settings", authMiddleware, function(req, res, next) {
                const permission = verifyGroups(req);
                if (res.statusCode === 403) {
                    runtime.logger.error("api post settings: Tocken Expired");
                } else if (!authJwt.haveAdminPermission(permission)) {
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
            apiApp.post('/api/heartbeat', authMiddleware, function (req, res) {
                if (!runtime.settings.secureEnabled) {
                    res.end();
                } else if (res.statusCode === 403) {
                    runtime.logger.error("api post heartbeat: Tocken Expired");
                }
                if (req.body.params) {

                    if (!req.isAuthenticated) {
                        // guest → NON puo rinnovare token
                        return res.status(200).json({
                            message: 'guest'
                        });
                    }

                    const token = authJwt.getNewTokenFromRequest(req);
                    return res.status(200).json({
                        message: 'tokenRefresh',
                        token
                    });
                }

                // Guest heartbeat
                if (req.userId === 'guest') {
                    return res.status(200).json({
                        message: 'guest',
                        token: authJwt.getGuestToken()
                    });
                }
                return res.end();
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
    runtime.settings.userRole = settings.userRole;
    runtime.settings.nodeRedEnabled = settings.nodeRedEnabled;
    runtime.settings.swaggerEnabled = settings.swaggerEnabled;
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
    if (settings.logs) {
        runtime.settings.logs = settings.logs;
    }
}

function verifyGroups(req) {
    if (runtime.settings && runtime.settings.secureEnabled) {
        if (req.apiKey) {
            return authJwt.adminGroups[0];
        }
        if (req.tokenExpired) {
            return (runtime.settings.userRole) ? null : 0;
        }
        const userInfo = runtime.users.getUserCache(req.userId);
        return (runtime.settings.userRole && req.userId !== 'admin') ? userInfo : userInfo ? userInfo.groups : req.userGroups;
    } else {
        return authJwt.adminGroups[0];
    }
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
