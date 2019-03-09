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

        // Project
        prjApp.get("/api/project", function(req, res) {
            console.log('/api/project');
            const data = runtime.project.getProject();
            // res.header("Access-Control-Allow-Origin", "*");
            // res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            if (data) {
                res.json(data);
            } else {
                res.status(404).end();
            }
        });
        prjApp.post("/api/project", function(req, res, next) {
            runtime.project.setProjectFile(req.body).then(function(data) {
                runtime.updateProject().then(function(result) {
                    res.end();
                });
            }).catch(function(err) {
                console.log(err.stack);
                if (err.code) {
                    res.status(400).json({error:err.code, message: err.message});
                } else {
                    res.status(400).json({error:"unexpected_error", message:err.toString()});
                }
            })
        });

        return prjApp;
    }
}