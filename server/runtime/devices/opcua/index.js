

function OpcUAclient(_data, _logger) {

    var data = _data;
    var logger = _logger;

    this.connect = function() {
        return new Promise(function (resolve, reject) {
            resolve();
        });
    }

    this.disconnect = function() {
    }

    this.load = function(_data) {
        data = _data;
    }    
}

function start() {
    // start polling timer
}

function stop() {
    // stop polling timer
}

module.exports = {
    init: function (settings) {
        // deviceCloseTimeout = settings.deviceCloseTimeout || 15000;
    },
    create: function (data, logger) {
        return new OpcUAclient(data, logger);
    }
}