/*
* Cleaner: delete/clear (database) operations 
*/
var utils = require('../utils');
var fs = require('fs')
var path = require('path');

'use strict';
const timeRange = {from: 1, to: 2};

function Cleaner(_runtime) {
    var runtime = _runtime;
    var logger = runtime.logger;
    var currentTime = 0;
    var lastExecuted;

    this.execute = function (time, force) {
        currentTime = time;
        return new Promise(async function (resolve, reject) {
            try {
                if (!_isToExecute(time) && !force) {
                    resolve(true);
                } else {
                    await _clearStorage().then(() => {
                        lastExecuted = currentTime;
                        resolve();
                    }).catch(function (err) {
                        reject(err);
                    });
                }
            } catch (err) {
                reject(err);
            }
        });
    }

    this.getProperty = function () {
        return null;
    }
    
    var _isToExecute = function (date) {
        // 1 time per day
        if (inTimeToExecute(date.getHours()) && utils.dayOfYear(lastExecuted) !== utils.dayOfYear(date)) {
            return true;
        }
        return false;
    }

    var _clearStorage = function () {
        return runtime.daqStorage.checkRetention();
    }
}

function inTimeToExecute(hour) {
    return (hour >= timeRange.from && hour <= timeRange.to);
}


const ReportDateRangeType = {
    none: 'none',
    day: 'day',
    week: 'week',
    month: 'month',
}

module.exports = {
    create: function (property, runtime) {
        return new Cleaner(property, runtime);
    },
}