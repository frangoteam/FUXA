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
                    const clearFncs = [await runtime.daqStorage.checkRetention(),
                                       await runtime.alarmsMgr.checkRetention(),
                                       await cleanupLogs(runtime.settings, runtime.logger)];

                    Promise.all(clearFncs).then(values => {
                        lastExecuted = currentTime;
                        resolve();
                    }, reason => {
                        if (reason && reason.stack) {
                            logger.error(`Cleaner.execute: ${reason.stack}`);
                        } else {
                            logger.error(`Cleaner.execute: ${reason}`);
                        }
                        reject(reason);
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
}

function inTimeToExecute(hour) {
    return (hour >= timeRange.from && hour <= timeRange.to);
}

const cleanupLogs = async (settings, logger) => {
    const { logs, logDir } = settings;

    if (!logs || logs.retention === 'none') {
        return;
    }

    try {
        const retentionLimit = utils.getRetentionLimit(logs.retention);
        const files = await fs.promises.readdir(logDir);
        let deletedCount = 0;

        for (const file of files) {
            const filePath = path.join(logDir, file);
            try {
                const stat = await fs.promises.stat(filePath);
                if (stat.mtimeMs < retentionLimit.getTime()) {
                    await fs.promises.unlink(filePath);
                    deletedCount++;
                }
            } catch (fileErr) {
                // ignore errors for individual files
            }
        }

        if (deletedCount > 0) {
            logger.info(`Logs cleanup completed. ${deletedCount} old file(s) deleted.`);
        }
    } catch (err) {
        logger.error('Error during logs cleanup', err);
    }
};

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