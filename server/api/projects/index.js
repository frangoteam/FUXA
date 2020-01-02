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
        var prjApp = express();
        prjApp.use(function(req,res,next) {
            if (!runtime.project) {
                res.status(404).end();
            } else {
                next();
            }
        });

        /**
         * GET Project data
         * Take from project storage and reply 
         */
        prjApp.get("/api/project", function(req, res) {
            console.log('/api/project');
            const data = runtime.project.getProject(req.body).then(result => {
                // res.header("Access-Control-Allow-Origin", "*");
                // res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
                if (result) {
                    res.json(result);
                } else {
                    res.status(404).end();
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
         * POST Project data
         * Set to project storage
         */
        prjApp.post("/api/project", function(req, res, next) {
            runtime.project.setProject(req.body).then(function(data) {
                runtime.restart().then(function(result) {
                    res.end();
                });
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
         * POST Single Project data
         * Set the value (general/view/device/...) to project storage
         */
        prjApp.post("/api/projectData", function(req, res, next) {
            // var param = JSON.parse(JSON.stringify(req.body));
            runtime.project.setProjectData(req.body.cmd, req.body.data).then(setres => {
                runtime.update(req.body.cmd, req.body.data).then(result => {
                    res.end();
                });
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
         * GET Project demo data
         * Take the project demo file from server folder 
         */
        prjApp.get("/api/projectdemo", function (req, res) {
            console.log('/api/projectdemo');
            const data = runtime.project.getProjectDemo();
            // res.header("Access-Control-Allow-Origin", "*");
            // res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            if (data) {
                res.json(data);
            } else {
                res.status(404).end();
            }
        });

        /**
         * GET Device property like security
         * Take from project storage and reply 
         */
        prjApp.get("/api/device", function(req, res) {
            console.log('/api/device');
            const data = runtime.project.getDeviceProperty(req.query).then(result => {
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
         * POST Device property
         * Set to project storage
         */
        prjApp.post("/api/device", function(req, res, next) {
            runtime.project.setDeviceProperty(req.body.params).then(function(data) {
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
        return prjApp;
    }
}