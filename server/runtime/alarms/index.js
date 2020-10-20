/*
* Alarms manager: check ... and save 
*/

'use strict';

const alarmstorage = require('./alarmstorage');

var ALARMS_CHECK_STATUS_INTERVAL = 1000;


function AlarmsManager(_runtime) {
    var runtime = _runtime;
    var devices = runtime.devices;      // Devices to ask variable value
    var events = runtime.events;        // Events to commit change to runtime
    var settings = runtime.settings;    // Settings
    var logger = runtime.logger;        // Logger
    var alarmsCheckStatus = null;       // TimerInterval to check Alarms status
    var alarmsLoading = false;          // Flag to check if loading
    var working = false;                // Working flag to manage overloading of check alarms status
    var alarms = {};                    // Alarms matrix, grupped by variable to check, [variable][...AlarmSubProperty + permission]
    var status = AlarmsStatusEnum.INIT; // Current status (StateMachine)
    var clearAlarms = false;            // Flag to clear current alarms from DB
    /**
     * Start TimerInterval to check Alarms
     */
    this.start = function () {
        return new Promise(function (resolve, reject) {
            var self = this;
            alarmsCheckStatus = setInterval(function () {
                _checkStatus();
            }, ALARMS_CHECK_STATUS_INTERVAL);
        });
    }

    /**
     * Stop StateMachine, Close Device connection, break all TimerInterval (Device status/polling)
     */
    this.stop = function () {
        return new Promise(function (resolve, reject) {
            logger.info('alarms.stop-checkstatus!');
            if (alarmsCheckStatus) {
                clearInterval(alarmsCheckStatus);
                alarmsCheckStatus = null;
                status = AlarmsStatusEnum.INIT;
            }
            resolve();
        });
    }

    
    this.reset = function () {
        this.clear();
        status = AlarmsStatusEnum.LOAD;
    }

    this.clear = function () {
        clearAlarms = true;
    }
    
    /**
     * Return the alarms status (active/passive alarms count), { highhigh: <count>, high: <count>, low: <count>, info: <count> } 
     */
    this.getAlarmsStatus = function () {
        return new Promise(function (resolve, reject) {
            alarmstorage.getAlarms().then(function (alarms) {
                var result = { highhigh: 0, high: 0, low: 0, info: 0 };
                if (alarms) {
                    Object.values(alarms).forEach(alr => {
                        result[alr.type]++;
                    });
                }
                resolve(result);
            }).catch(function (err) {
                reject(err);
            });
        });
    }

    /**
     * Return the alarms value (active/passive alarms count), { highhigh: <count>, high: <count>, low: <count>, info: <count> } 
     */
    this.getAlarmsValues = function () {
        return new Promise(function (resolve, reject) {
            var result = [];
            Object.keys(alarms).forEach(alrkey => {
                alarms[alrkey].forEach(alr => {
                    if (alr.status) {
                        var alritem = { name: alr.getId(), type: alr.type, ontime: alr.ontime, offtime: alr.offtime, acktime: alr.acktime, 
                            status: alr.status, text: alr.subproperty.text, group: alr.subproperty.group, 
                            bkcolor: alr.subproperty.bkcolor, color: alr.subproperty.color, toack: alr.isToAck() };
                        result.push(alritem);
                    }
                });
            });
            resolve(result);
        });
    }

    this.setAlarmAck = function (alarmname) {
        return new Promise(function (resolve, reject) {
            var changed = [];
            Object.keys(alarms).forEach(alrkey => {
                alarms[alrkey].forEach(alr => {
                    if (alr.getId() === alarmname) {
                        alr.setAck();
                        changed.push(alr);
                    }
                });
            });
            if (changed.length) {
                alarmstorage.setAlarms(changed).then(function (result) {
                    resolve(true);
                }).catch(function (err) {
                    reject(err);
                });
            } else {
                resolve(false);
            }
        });
    }

    /**
     * Check the Alarms state machine
     */
    var _checkStatus = function () {
        if (status === AlarmsStatusEnum.INIT) {
            if (_checkWorking(true)) {
                _init().then(function () {
                    status = AlarmsStatusEnum.LOAD;
                    _checkWorking(false);
                }).catch(function (err) {
                    // devices.woking = null;
                    _checkWorking(false);
                });
            }
        } else if (status === AlarmsStatusEnum.LOAD) {
            if (_checkWorking(true)) {
                _loadProperty().then(function () {
                    _loadAlarms().then(function () {
                        status = AlarmsStatusEnum.IDLE;
                        _emitAlarmsChanged();
                        _checkWorking(false);
                    }).catch(function (err) {
                        _checkWorking(false);
                    });
                }).catch(function (err) {
                    _checkWorking(false);
                });
            }
        } else if (status === AlarmsStatusEnum.IDLE) {
            if (_checkWorking(true)) {
                _checkAlarms().then(function (changed) {
                    if (changed) {
                        _emitAlarmsChanged();
                    }
                    _checkWorking(false);
                }).catch(function (err) {
                    _checkWorking(false);
                });
            }
        }
    }

    /**
     * Check Alarms status
     */
    var _checkAlarms = function () {
        return new Promise(function (resolve, reject) {
            var time = new Date().getTime();
            var changed = [];
            Object.keys(alarms).forEach(alrkey => {
                var groupalarms = alarms[alrkey];
                let tks = alrkey.split('^~^');
                var tag = devices.getDeviceValue(tks[0], tks[1]);
                if (tag !== null) {
                    groupalarms.forEach(alr => {
                        if (alr.check(time, tag.ts, Number(tag.value))) {
                            // changed
                            console.log('ALR: ' + alr.getId() + ' s:' + alr.status + ' on:' + _formatDateTime(alr.ontime) + ' off:' + _formatDateTime(alr.offtime) + 
                                        ' ack:' + _formatDateTime(alr.acktime) + ' ' + alr.toremove);
                            changed.push(alr);
                        }
                    });
                }
            });
            var end = new Date().getTime() - time;
            if (changed.length) {
                alarmstorage.setAlarms(changed).then(function (result) {
                    resolve(true);
                }).catch(function (err) {
                    reject(err);
                });
            } else {
                resolve(false);
            }
        });
    }

    /**
     * Init Alarm database
     */
    var _init = function () {
        return new Promise(function (resolve, reject) {
            alarmstorage.init(settings, logger).then(result => {
                logger.info('alarms.alarmstorage-init-successful!');
                resolve();
            }).catch(function (err) {
                logger.error('project.prjstorage.failed-to-init: ' + err);
                reject(err);
            });
        });
    }

    /**
     * Load Alarms property in local for check
     */
    var _loadProperty = function () {
        return new Promise(function (resolve, reject) {
            alarms = {};
            runtime.project.getAlarms().then(function (result) {
                var alarmsFound = 0;
                if (result) {
                    result.forEach(alr => {
                        if (alr.property && alr.property.variable && alr.property.variableSrc) {
                            if (!alarms[alr.property.variableId]) {
                                alarms[alr.property.variableId] = [];
                            }
                            if (_isAlarmEnabled(alr.highhigh)) {
                                var alarm = new Alarm(alr.name, 'highhigh', alr.highhigh, alr.property);
                                alarms[alr.property.variableId].push(alarm);
                                alarmsFound++;
                            } 
                            if (_isAlarmEnabled(alr.high)) {
                                var alarm = new Alarm(alr.name, 'high', alr.high, alr.property);
                                alarms[alr.property.variableId].push(alarm);
                                alarmsFound++;
                            }
                            if (_isAlarmEnabled(alr.low)) {
                                var alarm = new Alarm(alr.name, 'low', alr.low, alr.property);
                                alarms[alr.property.variableId].push(alarm);
                                alarmsFound++;
                            }
                            if (_isAlarmEnabled(alr.info)) {
                                var alarm = new Alarm(alr.name, 'info', alr.info, alr.property);
                                alarms[alr.property.variableId].push(alarm);
                                alarmsFound++;
                            }
                        }
                    });
                }
                // console.log('alarms.load-property! found: ' + alarmsFound);
                resolve();
            }).catch(function (err) {
                reject(err);
            });
        });
    }

    /**
     * Load current Alarms and merge with loaded property
     */ 
    var _loadAlarms = function () {
        return new Promise(function (resolve, reject) {
            if (clearAlarms) {
                alarmstorage.clearAlarms().then(result => {
                    resolve();
                    clearAlarms = false;
                }).catch(function (err) {
                    logger.error('alarms.clear-current.failed: ' + err);
                    reject(err);
                });
            } else {
                alarmstorage.getAlarms().then(result => {
                    Object.keys(alarms).forEach(alrkey => {
                        var groupalarms = alarms[alrkey];
                        groupalarms.forEach(alr => {
                            var alrid = alr.getId();
                            var curalr = result.find(ca => ca.nametype === alrid);
                            if (curalr) {
                                alr.status = curalr.status;
                                alr.ontime = curalr.ontime;
                                alr.offtime = curalr.offtime;
                                alr.acktime = curalr.acktime;
                            }
                        });
                    });
                    resolve();
                }).catch(function (err) {
                    logger.error('alarms.load-current.failed: ' + err);
                    reject(err);
                });
            }
        });
    }

    var _checkWorking = function (check) {
        if (check && working) {
            logger.error('alarms working (check) overload!');
            return false;
        }
        working = check;
        return true;
    }

    var _isAlarmEnabled = function (alarm) {
        if (alarm && alarm.enabled && alarm.checkdelay > 0) {
            return true;
        }
        return false;
    }

    var _emitAlarmsChanged = function () {
        events.emit('alarms-status:changed');
    }

    var _formatDateTime = function (dt) {
        var dt = new Date(dt);
        return dt.toLocaleDateString() + '-' + dt.toLocaleTimeString();
    }
}

module.exports = {
    create: function (runtime) {
        return new AlarmsManager(runtime);
    }
}

/**
 * State of StateMachine
 */
var AlarmsStatusEnum = {
    INIT: 'init',
    LOAD: 'load',
    IDLE: 'idle',
}

function Alarm(name, type, subprop, tagprop) {
    this.name = name;
    this.type = type;
    this.subproperty = subprop;
    this.tagproperty = tagprop;
    this.ontime = 0;
    this.offtime = 0;
    this.acktime = 0;
    this.status = AlarmStatusEnum.VOID;
    this.lastcheck = 0;
    this.toremove = false;

    this.getId = function () {
        return this.name + '^~^' + this.type;
    }

    this.check = function (time, dt, value) {
        if (this.lastcheck + (this.subproperty.checkdelay * 1000) > time) {
            return false;
        }
        this.lastcheck = time;
        this.toremove = false;
        var onrange = (value >= this.subproperty.min && value <= this.subproperty.max);
        switch(this.status) {
            case AlarmStatusEnum.VOID:
                //  check to activate
                if (!onrange) {
                    return false;
                } else if (!this.ontime) {
                    this.ontime = dt;
                    return false;
                }
                if (this.ontime + (this.subproperty.timedelay * 1000) < time) {
                    this.status = AlarmStatusEnum.ON;
                    return true;
                }
            case AlarmStatusEnum.ON:
                // check to deactivate
                if (!onrange) {
                    this.status = AlarmStatusEnum.OFF;
                    this.offtime = time;
                    // remove if float or already acknowledged
                    if (this.subproperty.ackmode === AlarmAckModeEnum.float || this.acktime) {
                        this.toRemove();
                    } 
                    return true;
                }
                if (this.acktime) {
                    this.status = AlarmStatusEnum.ACK;
                    return true;
                }
                return false;
            case AlarmStatusEnum.OFF:
                // check to reactivate
                if (onrange) {
                    this.status = AlarmStatusEnum.ON;
                    this.acktime = 0;
                    return true;
                }
                // remove if acknowledged
                if (this.acktime) {
                    this.toRemove();
                    return true;
                }
                return false;
            case AlarmStatusEnum.ACK:
                // remove if deactivate
                if (!onrange) {
                    this.toRemove();
                    return true;
                }
                return false;                
        }
    }

    this.toRemove = function () {
        this.toremove = true;
        this.ontime = 0;
        this.offtime = 0;
        this.acktime = 0;
        this.status = AlarmStatusEnum.VOID;
        this.lastcheck = 0;
    }

    this.setAck = function () {
        this.acktime = new Date().getTime();
        this.lastcheck = 0;
    }

    this.isToAck = function () {
        if (this.subproperty.ackmode === AlarmAckModeEnum.float) {
            return -1;
        }
        if (this.subproperty.ackmode === AlarmAckModeEnum.ackpassive && this.status === AlarmStatusEnum.ON) {
            return 0;
        }
        return 1;
    }
}

var AlarmStatusEnum = {
    VOID: '',
    ON: 'N',
    OFF: 'NF',
    ACK: 'NA'
}

var AlarmAckModeEnum = {
    float: 'float',
    ackactive: 'ackactive',
    ackpassive: 'ackpassive'
}