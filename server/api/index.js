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
const utils = require('../runtime/utils');

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

			if (runtime.settings.logApiLevel !== 'none') {
				apiApp.use(morgan(['combined', 'common', 'dev', 'short', 'tiny'].
				includes(runtime.settings.logApiLevel) ? runtime.settings.logApiLevel : 'combined'));
			}

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
            authApi.init(runtime, authJwt.secretCode, authJwt.tokenExpiresIn, runtime.settings.enableRefreshCookieAuth, runtime.settings.refreshTokenExpiresIn);
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
                max: 100, // limit each IP to 100 requests per windowMs
                // Keep lightweight health/version checks unthrottled
                skip: (req) => req.path === '/api/version'
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
                    if (tosend.daqstore?.credentials) {
                        delete tosend.daqstore.credentials;
                    }
                    if (tosend.auth) {
                        delete tosend.auth;
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
                    return;
                }
                if (!authJwt.haveAdminPermission(permission)) {
                    res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                    runtime.logger.error("api post settings: Unauthorized");
                    return;
                }
                try {
                    if (req.body.smtp && !req.body.smtp.password && runtime.settings.smtp && runtime.settings.smtp.password) {
                        req.body.smtp.password = runtime.settings.smtp.password;
                    }
                    if (utils.isEmptyObject(req.body.daqstore?.credentials) && runtime.settings.daqstore?.credentials) {
                        req.body.daqstore.credentials = runtime.settings.daqstore?.credentials;
                    }
                    if (!req.body.secretCode && runtime.settings.secretCode) {
                        req.body.secretCode = runtime.settings.secretCode;
                    }
                    preserveAuthSettings(req.body, runtime.settings);
                    const prevAuth = {
                        secureEnabled: runtime.settings.secureEnabled,
                        tokenExpiresIn: runtime.settings.tokenExpiresIn,
                        enableRefreshCookieAuth: runtime.settings.enableRefreshCookieAuth,
                        refreshTokenExpiresIn: runtime.settings.refreshTokenExpiresIn,
                        secretCode: runtime.settings.secretCode
                    };
                    if (req.body.nodeRedEnabled === true &&
                        utils.isNullOrUndefined(req.body.nodeRedAuthMode) &&
                        runtime.settings.nodeRedEnabled === false) {
                        req.body.nodeRedAuthMode = 'secure';
                    }
                    fs.writeFileSync(runtime.settings.userSettingsFile, JSON.stringify(req.body, null, 4));
                    mergeUserSettings(req.body);
                    if (prevAuth.secureEnabled !== runtime.settings.secureEnabled ||
                        prevAuth.tokenExpiresIn !== runtime.settings.tokenExpiresIn ||
                        prevAuth.enableRefreshCookieAuth !== runtime.settings.enableRefreshCookieAuth ||
                        prevAuth.refreshTokenExpiresIn !== runtime.settings.refreshTokenExpiresIn ||
                        prevAuth.secretCode !== runtime.settings.secretCode) {
                        authJwt.init(runtime.settings.secureEnabled, runtime.settings.secretCode, runtime.settings.tokenExpiresIn);
                        authApi.init(runtime, authJwt.secretCode, authJwt.tokenExpiresIn, runtime.settings.enableRefreshCookieAuth, runtime.settings.refreshTokenExpiresIn);
                    }
                    runtime.restart(true).then(function(result) {
                        res.end();
                    });
                } catch (err) {
                    res.status(400).json({ error: "unexpected_error", message: err });
                    runtime.logger.error("api post settings: " + err);
                }
            });

            /**
             * POST Test AD authentication with current settings.auth.ad
             * Body: { username: string, password: string }
             */
            apiApp.post("/api/settings/auth/test-ad", authMiddleware, async function (req, res) {
                const permission = verifyGroups(req);
                if (res.statusCode === 403) {
                    runtime.logger.error("api post settings/auth/test-ad: Tocken Expired");
                    return;
                }
                if (!authJwt.haveAdminPermission(permission)) {
                    res.status(401).json({ error: "unauthorized_error", message: "Unauthorized!" });
                    runtime.logger.error("api post settings/auth/test-ad: Unauthorized");
                    return;
                }
                try {
                    const username = req.body && req.body.username ? String(req.body.username).trim() : '';
                    const password = req.body && req.body.password ? String(req.body.password) : '';
                    if (!username || !password) {
                        return res.status(400).json({ error: "validation_error", message: "username and password are required" });
                    }
                    const user = await runtime.auth.authenticateByProvider('ad', { username, password }, { allowFallback: false });
                    let adGroups = [];
                    try {
                        const info = typeof user.info === 'string' ? JSON.parse(user.info) : (user.info || {});
                        adGroups = Array.isArray(info?.ad?.groups) ? info.ad.groups : [];
                    } catch (e) {
                    }
                    return res.json({
                        status: 'success',
                        message: 'ad authentication successful',
                        data: {
                            username: user.username,
                            fullname: user.fullname,
                            groups: user.groups,
                            roles: user.roles,
                            adGroups: adGroups
                        }
                    });
                } catch (err) {
                    if (err.status === 401) {
                        return res.status(401).json({ error: "unauthorized_error", message: "Invalid email/password!!!" });
                    }
                    if (err.status === 404) {
                        return res.status(404).json({ error: "not_found", message: "Not Found!" });
                    }
                    return res.status(400).json({ error: err.code || "unexpected_error", message: err.message || String(err) });
                }
            });

            /**
             * GET Heartbeat to check token
             */
            apiApp.post('/api/heartbeat', authMiddleware, function (req, res) {

                if (!runtime.settings.secureEnabled) {
                    return res.end();
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

function preserveAuthSettings(incomingSettings, currentSettings) {
    if (!incomingSettings || !currentSettings) {
        return incomingSettings;
    }
    if (utils.isNullOrUndefined(incomingSettings.auth) && currentSettings.auth) {
        incomingSettings.auth = currentSettings.auth;
    }
    return incomingSettings;
}

function mergeUserSettings(settings) {
    if (settings.language) {
        runtime.settings.language = settings.language;
    }
    if (!utils.isNullOrUndefined(settings.hideEditorOnboarding)) {
        runtime.settings.hideEditorOnboarding = settings.hideEditorOnboarding;
    }
    runtime.settings.broadcastAll = settings.broadcastAll;
    runtime.settings.secureEnabled = settings.secureEnabled;
    runtime.settings.logFull = settings.logFull;
    runtime.settings.userRole = settings.userRole;
    runtime.settings.nodeRedEnabled = settings.nodeRedEnabled;
    if (!utils.isNullOrUndefined(settings.nodeRedAuthMode)) {
        runtime.settings.nodeRedAuthMode = settings.nodeRedAuthMode;
    }
    if (!utils.isNullOrUndefined(settings.enableRefreshCookieAuth)) {
        runtime.settings.enableRefreshCookieAuth = settings.enableRefreshCookieAuth;
    }
    if (!utils.isNullOrUndefined(settings.refreshTokenExpiresIn)) {
        runtime.settings.refreshTokenExpiresIn = settings.refreshTokenExpiresIn;
    }
    if (!utils.isNullOrUndefined(settings.nodeRedUnsafeModules)) {
        runtime.settings.nodeRedUnsafeModules = settings.nodeRedUnsafeModules;
    }
    runtime.settings.swaggerEnabled = settings.swaggerEnabled;
    if (!utils.isNullOrUndefined(settings.auth)) {
        runtime.settings.auth = settings.auth;
    }
    if (settings.secretCode) {
        runtime.settings.secretCode = settings.secretCode;
    }
    if (settings.secureEnabled) {
        runtime.settings.tokenExpiresIn = settings.tokenExpiresIn;
        runtime.settings.enableRefreshCookieAuth = settings.enableRefreshCookieAuth;
        runtime.settings.refreshTokenExpiresIn = settings.refreshTokenExpiresIn;
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
        if (runtime.settings.userRole && req.userId !== 'admin') {
            if (userInfo) {
                return userInfo;
            }
            // Keep role-mode authorization functional for external providers
            return {
                groups: req.userGroups,
                info: {
                    roles: Array.isArray(req.userRoles) ? req.userRoles : []
                }
            };
        }
        return userInfo ? userInfo.groups : req.userGroups;
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
