/**
 * 'api/daq': DAQ API to GET/POST storage daq data
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
        var daqApp = express();
        daqApp.use(function (req, res, next) {
            if (!runtime.project) {
                res.status(404).end();
            } else {
                next();
            }
        });

        /**
         * GET daq data
         * Take from daq storage data and reply
         */
         daqApp.get("/api/daq", secureFnc, function(req, res) {
            try {
                if (req.query && req.query.query) {
                    var query = JSON.parse(req.query.query);
                    var dbfncs = [];
                    for (let i = 0; i < query.sids.length; i++) {
                        if (query.to === query.from) {  // current values
                            dbfncs.push([runtime.devices.getTagValue(query.sids[i], true)]);
                        } else if(query.group) {
                            let options = {
                                functions: ['average'],
                                interval: query.group.by,
                                formats: [2]
                            }
                            dbfncs.push(runtime.daqStorage.getNodesValues([query.sids[i]], query.from, query.to,options));
                        } else {                        // from history
                            dbfncs.push(runtime.daqStorage.getNodeValues(query.sids[i], query.from, query.to));
                        }
                    }
                    if (query.to === query.from) {  // current values
                        res.json(dbfncs);
                    } else {
                        Promise.all(dbfncs).then(values => {
                            if (values && !query.group) {
                                res.json(values);
                            } else if(values && query.group){
                                res.json(filterIncludeData(values,query.group));
                            }else {
                                res.status(404).end();
                                runtime.logger.error("api get daq: Not Found!");
                            }
                        }, reason => {
                            if (reason && reason.stack) {
                                runtime.logger.error(`api get daq: Not Found!: ${reason.stack}`);
                                res.status(400).json({error:"unexpected_error", message: reason.stack});
                            } else {
                                runtime.logger.error(`api get daq: Not Found!: ${reason}`);
                                res.status(400).json({error:"unexpected_error", message: reason});
                            }
                        });
                    }
                } else {
                    res.status(404).end();
                    runtime.logger.error("api get daq: Not Found!");
                }
            } catch (err) {
                if (err && err.code) {
                    res.status(400).json({error:err.code, message: err.message});
                } else {
                    res.status(400).json({error:"unexpected_error", message:err.toString()});
                }
                runtime.logger.error("api get daq: " + err.message);
            }
        });
        return daqApp;
    }
}

const filterIncludeData = function (values, group) {
    let resValues = []
    if (group && group.includes && group.includes.length > 0) {
        for (let i = 0; i < values.length; i++) {
            let rows = []
            for (let j = 0; j < values[i].length; j++) {
                let row = values[i][j]
                let dateTime = new Date(row[0])
                if (group.by === 'year') {
                    if (group.includes.includes(dateTime.getFullYear())) {
                        rows.push({dt:dateTime.getTime(),value:row[1]});
                    }
                } else if (group.by === 'month') {
                    if (group.includes.includes(dateTime.getMonth() - 1)) {
                        rows.push({dt:dateTime.getTime(),value:row[1]});
                    }
                } else if (group.by === 'day') {
                    if (group.includes.includes(dateTime.getDate())) {
                        rows.push({dt:dateTime.getTime(),value:row[1]});
                    }
                } else if (group.by === 'hour') {
                    if (group.includes.includes(dateTime.getHours())) {
                        rows.push({dt:dateTime.getTime(),value:row[1]});
                    }
                } else if (group.by === 'minute') {
                    if (group.includes.includes(dateTime.getMinutes())) {
                        rows.push({dt:dateTime.getTime(),value:row[1]});
                    }
                } else {
                    rows.push({dt:dateTime.getTime(),value:row[1]});
                }
            }
            resValues.push(rows);
        }
    }
    return resValues;
};
