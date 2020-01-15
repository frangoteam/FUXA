/**
 * 'api/project': API server initialization and general GET/POST
 */

var express = require("express");
var bodyParser = require("body-parser");
const authJwt = require('./jwt-helper');

var prjApi = require("./projects");
var authApi = require("./auth");
var usersApi = require("./users");

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
            authJwt.init(runtime.settings.secretCode);
            prjApi.init(runtime, authJwt.verifyToken);
            apiApp.use(prjApi.app());
            usersApi.init(runtime, authJwt.verifyToken);
            apiApp.use(usersApi.app());
            authApi.init(runtime, authJwt.secretCode);
            apiApp.use(authApi.app());

            /**
             * GET Server setting data
             */
            apiApp.get("/api/settings", function (req, res) {
                console.log('/api/settings');
                if (runtime.settings) {
                    // res.header("Access-Control-Allow-Origin", "*");
                    // res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");                    
                    res.json(runtime.settings);
                } else {
                    res.status(404).end();
                }
            });
            runtime.logger.info("api: init successful!");
        } else {
        }
        resolve();
    });
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
