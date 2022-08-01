/**
 * 'api/command': Command API to process command like build Report
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
    app: function () {
        var commandApp = express();
        commandApp.use(function (req, res, next) {
            if (!runtime.project) {
                res.status(404).end();
            } else {
                next();
            }
        });

        /**
         * POST build report
         */
         commandApp.post("/api/buildreport", secureFnc, function (req, res, next) {
            var groups = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api post buildreport: Tocken Expired");
            } else if (authJwt.adminGroups.indexOf(groups) === -1 ) {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api post buildreport: Unauthorized");
            } else {           
                if (runtime.jobsMgr.forceReport(req.body.params.report)) {
                    res.end();
                } else {
                    res.status(400).json({ error: "not_found", message: 'report not found!'});
                    runtime.logger.error("api post buildreport: " + 'report not found!');
                }
            }
        });

        return commandApp;
    }
}
