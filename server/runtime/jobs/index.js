/*
* Jobs manager: check, reports, ...
*/

var Report = require('./report');
var Cleaner = require('./cleaner');

'use strict';

var JOBS_CHECK_STATUS_INTERVAL = 1000 * 60 * 30;    // 30 min.
var MILLI_MINUTE = 60000;

function JobsManager(_runtime) {
    var runtime = _runtime;
    var events = runtime.events;        // Events to commit change to runtime
    var logger = runtime.logger;        // Logger
    var jobsCheckStatus = null;         // TimerInterval to check Jobs status
    var working = false;                // Working flag to manage overloading of check notificator status
    var jobsList = [];                  // Jobs list to process
    var status = JobsStatusEnum.INIT;   // Current status (StateMachine)
    var lastCheck = 0;                  // Timestamp to check intervall only in IDLE
    var forceCheck = true;              // Flag to manage the forcing of check jobs

    /**
     * Start TimerInterval to check Jobs
     */
    this.start = function () {
        return new Promise(function (resolve, reject) {
            logger.info('jobs check start', true);
            jobsCheckStatus = setInterval(function () {
                _checkStatus();     // check in 20 seconds interval
            }, 5000);
        });
    }

    /**
     * Stop StateMachine, break TimerInterval (_checkStatus)
     */
    this.stop = function () {
        return new Promise(function (resolve, reject) {
            logger.info('jobs.stop-checkstatus!', true);
            if (jobsCheckStatus) {
                clearInterval(jobsCheckStatus);
                jobsCheckStatus = null;
                status = JobsStatusEnum.INIT;
                working = false;
            }
            resolve();
        });
    }

    this.reset = function () {
        status = JobsStatusEnum.LOAD;
    }

    this.forceReport = function (report) {
        var found = false;
        jobsList.forEach(item => {    
            let jp = item.job.getProperty();
            if (item.type === JobType.Report && jp.id === report.id) {
                item.force = true;
                forceCheck = true;
                found = true;
            }
        });
        return found;
    }

    /**
     * Check the Jobs state machine
     */
    var _checkStatus = function () {
        if (status === JobsStatusEnum.INIT) {
            if (_checkWorking(true)) {
                _init().then(function () {
                    status = JobsStatusEnum.LOAD;
                    _checkWorking(false);
                }).catch(function (err) {
                    _checkWorking(false);
                });
            }
        } else if (status === JobsStatusEnum.LOAD) {
            if (_checkWorking(true)) {
                _loadJobs().then(function () {
                    status = JobsStatusEnum.IDLE;
                    _checkWorking(false);
                }).catch(function (err) {
                    _checkWorking(false);
                });
            }
        } else if (status === JobsStatusEnum.IDLE) {
            if (jobsList.length) {
                var current = new Date().getTime();
                if (forceCheck || current - lastCheck > JOBS_CHECK_STATUS_INTERVAL) {
                    lastCheck = current;
                    forceCheck = false;
                    if (_checkWorking(true)) {
                        _checkJobs().then(function () {
                            _checkWorking(false);
                        }).catch(function (err) {
                            _checkWorking(false);
                        });
                    }
                }
            }
        }
    }

    /**
     * Init Jobs resource
     */
    var _init = function () {
        return new Promise(function (resolve, reject) {
            resolve();
        });
    }

    var _checkWorking = function (check) {
        if (check && working) {
            logger.warn('jobs working (check) overload!');
            return false;
        }
        working = check;
        return true;
    }

    /**
     * Load current Jobs: Reports
     */
    var _loadJobs = function () {
        return new Promise(function (resolve, reject) {
            jobsList = [];
            // cleaner
            try {
                var cleaner = Cleaner.create(runtime);
                var job = new Job(cleaner, JobType.Cleaner);
                jobsList.push(job);    
            } catch (err) {
                logger.error(`_loadJobs.cleaner.failed: ${err}`);
            }    
            // reports
            runtime.project.getReports().then(function (result) {
                if (result) {
                    result.forEach(rptProperty => {
                        if (rptProperty.scheduling !== Report.ReportSchedulingType.none) {
                            var report = Report.create(rptProperty, runtime);
                            var job = new Job(report, JobType.Report);
                            jobsList.push(job);
                        }
                    });
                }
                resolve();
            }).catch(function (err) {
                reject(err);
            });
        });
    }

    /**
     * Check Jobs status
     */
    var _checkJobs = function () {
        return new Promise(async function (resolve, reject) {
            var jobsExecute = []
            try {
                jobsList.forEach(item => {
                    if (item.job['execute']) {
                        jobsExecute.push(item.job['execute'](new Date(), item.force));
                        item.force = false;
                    }
                });
                Promise.all(jobsExecute).then(values => {
                    resolve(values);
                }, reason => {
                    if (reason && reason.stack) {
                        logger.error(`checkJobs: ${reason.stack}`);
                    } else {
                        logger.error(`checkJobs: ${reason}`);
                    }
                    reject(reason);
                });
            } catch (err) {
                logger.error(`checkJobs.failed: ${err}`);
                reject(err);
            }                
        });
    }
}

module.exports = {
    create: function (runtime) {
        return new JobsManager(runtime);
    }
}

/**
 * State of Jobs manager
 */
const JobsStatusEnum = {
    INIT: 'init',
    LOAD: 'load',
    IDLE: 'idle',
}

function Job(_job, _type) {
    this.job = _job;
    this.type = _type;
    this.force = false;
}

const JobType = {
    Report: 1,
    Cleaner: 2,
}