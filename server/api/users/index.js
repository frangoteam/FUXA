/**
 * 'api/users': Users API to GET/POST users data
 */

var express = require("express");
const authJwt = require('../jwt-helper');
var runtime;
var secureFnc;

module.exports = {
    init: function (_runtime, _secureFnc) {
        runtime = _runtime;
        secureFnc = _secureFnc;
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
            console.log('/api/users');
            const data = runtime.users.getUsers(req.query).then(result => {
                // res.header("Access-Control-Allow-Origin", "*");
                // res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
                if (result) {
                    res.json(result);
                } else {
                    res.end();
                }
            }).catch(function(err) {
                console.log(err.stack);
                if (err.code) {
                    res.status(400).json({error:err.code, message: err.message});
                } else {
                    res.status(400).json({error:"unexpected_error", message:err.toString()});
                }
            })
        });

        /**
         * POST Users
         * Set to users storage
         */
        usersApp.post("/api/users", secureFnc, function(req, res, next) {
            runtime.users.setUsers(req.body.params).then(function(data) {
                res.end();
            }).catch(function(err) {
                console.log(err.stack);
                if (err.code) {
                    res.status(400).json({error:err.code, message: err.message});
                } else {
                    res.status(400).json({error:"unexpected_error", message:err.toString()});
                }
            });
        });
        
                /**
         * DELETE User
         * Set to project storage
         */
        usersApp.delete("/api/users", secureFnc, function(req, res, next) {
            runtime.users.removeUsers(req.query.param).then(function(data) {
                res.end();
            }).catch(function(err) {
                console.log(err.stack);
                if (err.code) {
                    res.status(400).json({error:err.code, message: err.message});
                } else {
                    res.status(400).json({error:"unexpected_error", message:err.toString()});
                }
            });
        });   
        return usersApp;
    }
}