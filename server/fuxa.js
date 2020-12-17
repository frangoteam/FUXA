'use strict';

var path = require('path');

var runtime = require('./runtime');
var api = require('./api');

var logger;
var version;
var settings;
var api;

function getVersion() {
    if (!version) {
        version = require(path.join(__dirname, 'package.json')).version;
    }
    return version;
}

module.exports = {
    init: function (httpServer, io, _settings, log, events) {
        settings = _settings;
        logger = log;
        runtime.init(io, api, settings, logger, events);
        api.init(httpServer, runtime);
    },
    start: function () {
        return runtime.start().then(function () {
            logger.info('FUXA started!');
        });
    },
    stop: function () {
        return runtime.stop().then(function () {
            logger.info('FUXA stopped!');
        })
    },

    version: getVersion,
    get httpApi() { return api.apiApp },
};