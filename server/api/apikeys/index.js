/**
 * 'api/apikeys': ApiKeys API to GET/POST/DELETE apikeys
 */

var express = require("express");
const authJwt = require('../jwt-helper');
var runtime;
var secureFnc;
var checkGroupsFnc;

module.exports = {
    init: function (_runtime, _secureFnc, _checkGroupsFnc) {
        runtime = _runtime;
        secureFnc = _secureFnc;
        checkGroupsFnc = _checkGroupsFnc;
    },
    app: function() {
        var apiKeysApp = express();
        apiKeysApp.use(function(req,res,next) {
            if (!runtime.project) {
                res.status(404).end();
            } else {
                next();
            }
        });

        /**
         * GET ApiKeys
         * Take from ApiKeys storage and reply
         */
        apiKeysApp.get("/api/apikeys", secureFnc, function(req, res) {
            const permission = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api get apikeys: Tocken Expired");
            } else if (!authJwt.haveAdminPermission(permission)) {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api get apikeys: Unauthorized!");
            } else {
                runtime.apiKeys.getApiKeys(req.query).then(result => {
                    if (result) {
                        res.json(result);
                    } else {
                        res.end();
                    }
                }).catch(function(err) {
                    if (err.code) {
                        res.status(400).json({error:err.code, message: err.message});
                    } else {
                        res.status(400).json({error:"unexpected_error", message:err.toString()});
                    }
                    runtime.logger.error("api get apikeys: " + err.message);
                });
            }
        });

        /**
         * POST ApiKeys
         * Set apikeys storage
         */
        apiKeysApp.post("/api/apikeys", secureFnc, function(req, res, next) {
            const permission = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api post apikeys: Tocken Expired");
            } else if (!authJwt.haveAdminPermission(permission)) {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api post apikeys: Unauthorized");
            } else {
                runtime.apiKeys.setApiKeys(req.body.params).then(function(data) {
                    res.end();
                }).catch(function(err) {
                    if (err.code) {
                        res.status(400).json({error:err.code, message: err.message});
                    } else {
                        res.status(400).json({error:"unexpected_error", message:err.toString()});
                    }
                    runtime.logger.error("api post apikeys: " + err.message);
                });
            }
        });

        /**
         * DELETE Roles
         * Delete apikeys from storage
         */
        apiKeysApp.delete("/api/apikeys", secureFnc, function(req, res, next) {
            const permission = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api delete apikeys: Tocken Expired");
            } else if (!authJwt.haveAdminPermission(permission)) {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api delete apikeys: Unauthorized");
            } else {
                runtime.apiKeys.removeApiKeys(JSON.parse(req.query.apikeys)).then(function(data) {
                    res.end();
                }).catch(function(err) {
                    if (err.code) {
                        res.status(400).json({error:err.code, message: err.message});
                    } else {
                        res.status(400).json({error:"unexpected_error", message:err.toString()});
                    }
                    runtime.logger.error("api delete apikeys: " + err.message);
                });
            }
        });
        return apiKeysApp;
    }
}