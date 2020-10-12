/**
 * 'api/project': API server initialization and general GET/POST
 */

var express = require("express");
var bodyParser = require("body-parser");
var authJwt = require('./jwt-helper');

var prjApi = require("./projects");
var authApi = require("./auth");
var usersApi = require("./users");
var alarmsApi = require("./alarms");

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
            
            var maxApiRequestSize = runtime.settings.apiMaxLength || '15mb';
            apiApp.use(bodyParser.json({limit:maxApiRequestSize}));
            apiApp.use(bodyParser.urlencoded({limit:maxApiRequestSize,extended:true}));
            authJwt.init(runtime.settings.secretCode, runtime.settings.tokenExpiresIn);
            prjApi.init(runtime, authJwt.verifyToken, verifyGroups);
            apiApp.use(prjApi.app());
            usersApi.init(runtime, authJwt.verifyToken, verifyGroups);
            apiApp.use(usersApi.app());
            alarmsApi.init(runtime, authJwt.verifyToken, verifyGroups);
            apiApp.use(alarmsApi.app());
            authApi.init(runtime, authJwt.secretCode, authJwt.tokenExpiresIn);
            apiApp.use(authApi.app());

            /**
             * GET Server setting data
             */
            apiApp.get("/api/settings", function (req, res) {
                if (runtime.settings) {
                    let tosend = JSON.parse(JSON.stringify(runtime.settings));
                    delete tosend.secretCode;
                    // res.header("Access-Control-Allow-Origin", "*");
                    // res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");                    
                    res.json(tosend);
                } else {
                    res.status(404).end();
                    runtime.logger.error("api get settings: Value Not Found!");
                }
            });
            runtime.logger.info("api: init successful!");
        } else {
        }
        resolve();
    });
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
    get server() { return server; }
};
