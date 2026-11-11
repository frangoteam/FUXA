/**
 * 'api/scripts': Scripts API to POST run script
 */

const fs = require('fs');
const path = require('path');
var express = require("express");
const authJwt = require('../jwt-helper');
var runtime;
var secureFnc;
var checkGroupsFnc;


/**
 * Admins may call any system function. Other authenticated users may only call
 * functions explicitly enabled in Project > Frontend Script Access (clientAccess).
 */
function isSysFunctionAuthorised(functionName, permission) {
    if (authJwt.haveAdminPermission(permission)) {
        return true;
    }
    if (permission === null || permission === undefined) {
        return false;
    }
    if (typeof functionName !== 'string' || !functionName || !runtime.project || typeof runtime.project.getClientAccess !== 'function') {
        return false;
    }
    const access = runtime.project.getClientAccess() || {};
    const allowed = Array.isArray(access.scriptSystemFunctions) ? access.scriptSystemFunctions : [];
    // Ignore surrounding whitespace in configured names
    return allowed.some(name => typeof name === 'string' && name.trim() === functionName);
}

module.exports = {
    init: function (_runtime, _secureFnc, _checkGroupsFnc) {
        runtime = _runtime;
        secureFnc = _secureFnc;
        checkGroupsFnc = _checkGroupsFnc;
    },
    app: function () {
        var scriptsApp = express();
        scriptsApp.use(function (req, res, next) {
            if (!runtime.project) {
                res.status(404).end();
            } else {
                next();
            }
        });

        /**
         * POST runscript
         * Run script, can be call with script id or script content as test
         */
         scriptsApp.post("/api/runscript", secureFnc, function (req, res, next) {
            const permission = checkGroupsFnc(req);
            const script = req.body?.params?.script;
            if (res.statusCode === 403) {
                runtime.logger.error("api post runscript: Tocken Expired");
                //runtime.settings.secureEnabled
            } else if (runtime.settings?.secureEnabled && script?.test &&
                       (!req.isAuthenticated || !authJwt.haveAdminPermission(permission))) {
                res.status(401).json({ error: "unauthorized_error", message: "Unauthorized!" });
                runtime.logger.error("api post runscript: Unauthorized test mode");
            } else if (!script?.test && !script?.id) {
                res.status(400).json({ error: "invalid_request", message: "Script id is required!" });
                runtime.logger.error("api post runscript: Missing script id");
            } else if (!runtime.scriptsMgr.isAuthorised(script, permission)) {
                res.status(400).json({ error: "unauthorized_error", message: "Unauthorized!" });
                runtime.logger.error("api post runscript: Unauthorized");
            } else {
                //req.body.params.script.parameters.permission = groups;
                runtime.scriptsMgr.runScript(script, req.body.params.toLogEvent).then(function (result) {
                    res.json(result);
                }).catch(function (err) {
                    if (err.code) {
                        res.status(400).json({ error: err.code, message: err.message });
                        runtime.logger.error("api post runscript: " + err.message);
                    } else {
                        res.status(400).json({ error: "unexpected_error", message: err.toString() });
                        runtime.logger.error("api post runscript: " + err);
                    }
                });
            }
        });

        /**
         * POST run server script and return result value
         */
        scriptsApp.post("/api/runSysFunction", secureFnc, async function (req, res, next) {
            var groups = checkGroupsFnc(req);
            const rawName = req.body?.params?.functionName;
            const functionName = typeof rawName === 'string' ? rawName.trim() : rawName;
            if (res.statusCode === 403) {
                runtime.logger.error("api post runSysFunction: Tocken Expired");
            } else if (!isSysFunctionAuthorised(functionName, groups)) {
                res.status(400).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api post runSysFunction: Unauthorized");
            } else {
                try {
                    if (runtime.scriptsMgr.sysFunctionExist(functionName)) {
                        //req.body.params.parameters.permission = groups;
                        const result = await runtime.scriptsMgr.runSysFunction(functionName, req.body.params.parameters);
                        res.json(result);
                    } else {
                        res.status(400).json({ error: "not_found", message: 'script not found!'});
                        runtime.logger.error("api post runSysFunction: " + 'script not found!');
                    }
                } catch (error) {
                    res.status(400).json({ error: "error", message: error});
                    runtime.logger.error("api post runSysFunction: " + error);
                }
            }
        });
        return scriptsApp;
    }
}
