/**
 * 'api/daq': DAQ API to GET/POST storage daq data
 */

var express = require("express");
const authJwt = require('../jwt-helper');
const utils = require('../../runtime/utils');

const TIME_CHUNK_SIZE = 6 * 60 * 60 * 1000;
const MAX_TIME_CHUNKS = 744; // Maximum history range: 186 days

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
                    const maxSids = 100;
                    if (!query || !Array.isArray(query.sids) || query.sids.length > maxSids) {
                        return res.status(400).json({
                            error: "invalid_query",
                            message: `sids must be an array containing at most ${maxSids} items`
                        });
                    }
                    const isCurrentValues = query.to === query.from;
                    if (!Number.isFinite(query.from) || !Number.isFinite(query.to) ||
                        (!isCurrentValues && (query.from >= query.to ||
                            query.to - query.from > TIME_CHUNK_SIZE * MAX_TIME_CHUNKS))) {
                        return res.status(400).json({
                            error: "invalid_query",
                            message: "invalid DAQ time range (maximum history range is 186 days)"
                        });
                    }

                    var dbfncs = [];
                    if (isCurrentValues) {
                        for (let i = 0; i < query.sids.length; i++) {
                            dbfncs.push([runtime.devices.getTagValue(query.sids[i], true)]);
                        }
                    }
                    if (query.to === query.from) {  // current values
                        res.json(dbfncs);
                    } else {
                        const timeChunks = utils.chunkTimeRange(query.from, query.to, TIME_CHUNK_SIZE);
                        (async () => {
                            const values = [];
                            // Process one tag and time chunk at a time to avoid concurrent
                            // unbounded SQLite result materialization across tags.
                            for (const sid of query.sids) {
                                const tagValues = [];
                                for (let chunkIndex = 0; chunkIndex < timeChunks.length; chunkIndex++) {
                                    const chunk = timeChunks[chunkIndex];
                                    // Storage ranges are inclusive; advance later chunks by 1 ms
                                    // so samples on a boundary are not returned twice.
                                    const chunkStart = chunkIndex === 0 ? chunk.start : chunk.start + 1;
                                    const chunkValues = await runtime.daqStorage.getNodeValues(sid, chunkStart, chunk.end);
                                    for (const value of chunkValues) {
                                        tagValues.push(value);
                                    }
                                }
                                values.push(tagValues);
                            }
                            res.json(values);
                        })().catch(reason => {
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
                if (err instanceof RangeError && err.message === 'DAQ time range cannot be safely chunked') {
                    return res.status(400).json({
                        error: 'invalid_query',
                        message: err.message
                    });
                }
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
