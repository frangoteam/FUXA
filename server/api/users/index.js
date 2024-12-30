/**
 * 'api/users': Users API to GET/POST users data
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
        var usersApp = express();
        usersApp.use(function(req,res,next) {
            if (!runtime.project) {
                res.status(404).end();
            } else {
                next();
            }
        });

        /**
         * GET Users
         * Take from users storage and reply 
         */
        usersApp.get("/api/users", secureFnc, function(req, res) {
            const permission = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api get users: Tocken Expired");
            } else if (!authJwt.haveAdminPermission(permission)) {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api get users: Unauthorized!");
            } else {
                runtime.users.getUsers(req.query).then(result => {
                    // res.header("Access-Control-Allow-Origin", "*");
                    // res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
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
                    runtime.logger.error("api get users: " + err.message);
                });                
            }
        });

        /**
         * POST Users
         * Set to users storage
         */
        usersApp.post("/api/users", secureFnc, function(req, res, next) {
            const permission = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api post users: Tocken Expired");
            } else if (!authJwt.haveAdminPermission(permission)) {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api post users: Unauthorized");
            } else {
                runtime.users.setUsers(req.body.params).then(function(data) {
                    res.end();
                }).catch(function(err) {
                    if (err.code) {
                        res.status(400).json({error:err.code, message: err.message});
                    } else {
                        res.status(400).json({error:"unexpected_error", message:err.toString()});
                    }
                    runtime.logger.error("api post users: " + err.message);
                });                
            }
        });
        
        /**
         * DELETE User
         * Delete to users storage
         */
        usersApp.delete("/api/users", secureFnc, function(req, res, next) {
            const permission = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api delete users: Tocken Expired");
            } else if (!authJwt.haveAdminPermission(permission)) {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api delete users: Unauthorized");
            } else {
                runtime.users.removeUsers(req.query.param).then(function(data) {
                    res.end();
                }).catch(function(err) {
                    if (err.code) {
                        res.status(400).json({error:err.code, message: err.message});
                    } else {
                        res.status(400).json({error:"unexpected_error", message:err.toString()});
                    }
                    runtime.logger.error("api delete users: " + err.message);
                });                
            }
        });

        /**
         * GET Roles
         * Take from roles storage and reply 
         */
        usersApp.get("/api/roles", secureFnc, function(req, res) {
            const permission = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api get roles: Tocken Expired");
            } else if (!authJwt.haveAdminPermission(permission)) {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api get user roles: Unauthorized!");
            } else {
                runtime.users.getRoles(req.query).then(result => {
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
                    runtime.logger.error("api get roles: " + err.message);
                });                
            }
        });

        /**
         * POST Roles
         * Set roles to users storage
         */
        usersApp.post("/api/roles", secureFnc, function(req, res, next) {
            const permission = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api post roles: Tocken Expired");
            } else if (!authJwt.haveAdminPermission(permission)) {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api post roles: Unauthorized");
            } else {
                runtime.users.setRoles(req.body.params).then(function(data) {
                    res.end();
                }).catch(function(err) {
                    if (err.code) {
                        res.status(400).json({error:err.code, message: err.message});
                    } else {
                        res.status(400).json({error:"unexpected_error", message:err.toString()});
                    }
                    runtime.logger.error("api post roles: " + err.message);
                });                
            }
        });
        
        /**
         * DELETE Roles
         * Delete roles from users storage
         */
        usersApp.delete("/api/roles", secureFnc, function(req, res, next) {
            const permission = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api delete roles: Tocken Expired");
            } else if (!authJwt.haveAdminPermission(permission)) {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api delete roles: Unauthorized");
            } else {
                runtime.users.removeRoles(JSON.parse(req.query.roles)).then(function(data) {
                    res.end();
                }).catch(function(err) {
                    if (err.code) {
                        res.status(400).json({error:err.code, message: err.message});
                    } else {
                        res.status(400).json({error:"unexpected_error", message:err.toString()});
                    }
                    runtime.logger.error("api delete roles: " + err.message);
                });                
            }
        });
        return usersApp;
    }
}