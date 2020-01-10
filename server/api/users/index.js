/**
 * 'api/project': Project API to GET/POST project data
 */

var express = require("express");
var runtime;

module.exports = {
    init: function(_runtime) {
        runtime = _runtime;
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
        usersApp.get("/api/users", function(req, res) {
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
        usersApp.post("/api/users", function(req, res, next) {
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
        usersApp.delete("/api/users", function(req, res, next) {
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