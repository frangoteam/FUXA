/*
* Alarms manager: check ... and save 
*/

'use strict';

const alarmstorage = require('./alarmstorage');
var utils = require('./../utils');

var ALARMS_CHECK_STATUS_INTERVAL = 1000;
var TimeMultiplier	= 1000;		//1000 = rates are in seconds - alpaslanske

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
    var alarmsProperty = {};            // Alarms property list, key = alarm name + ^~^ + type
    var status = AlarmsStatusEnum.INIT; // Current status (StateMachine)
    var clearAlarms = false;            // Flag to clear current alarms from DB
    var actionsProperty = {};           // Actions property list, key = alarm name + ^~^ + type

    /**
     * Start TimerInterval to check Alarms
     */
    this.start = function () {
        return new Promise(function (resolve, reject) {
            logger.info('alarms check start', true);
            alarmsCheckStatus = setInterval(function () {
                _checkStatus();
            }, ALARMS_CHECK_STATUS_INTERVAL);
        });
    }

    /**
     * Stop StateMachine, break TimerInterval (_checkStatus)
     */
    this.stop = function () {
        return new Promise(function (resolve, reject) {
            logger.info('alarms.stop-checkstatus!', true);
            if (alarmsCheckStatus) {
                clearInterval(alarmsCheckStatus);
                alarmsCheckStatus = null;
                status = AlarmsStatusEnum.INIT;
                working = false;
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
            alarmstorage.getAlarms().then(function (alrs) {
                var result = { highhigh: 0, high: 0, low: 0, info: 0, actions: [] };
                if (alrs) {
                    Object.values(alrs).forEach(alr => {
                        result[alr.type]++;
                        if (alr.type === AlarmsTypes.ACTION && !alr.offtime) {
                            var action = actionsProperty[alr.nametype];
                            if (action.subproperty) {
                                if (action.subproperty.type === ActionsTypes.POPUP || action.subproperty.type === ActionsTypes.SET_VIEW) {
                                    result.actions.push({ type: action.subproperty.type, params: action.subproperty.actparam })
                                }
                            }
                        }
                    });
                }
                resolve(result);
            }).catch(function (err) {
                reject(err);
            });
        });
    }

    /**
     * Return the current active alarms values
     */
    this.getAlarmsValues = function (query, groups) {
        var result = [];
        Object.keys(alarms).forEach(alrkey => {
            alarms[alrkey].forEach(alr => {
                if (alr.status && alr.type !== AlarmsTypes.ACTION) {
                    var alritem = { name: alr.getId(), type: alr.type, ontime: alr.ontime, offtime: alr.offtime, acktime: alr.acktime, 
                        status: alr.status, text: alr.subproperty.text, group: alr.subproperty.group, 
                        bkcolor: alr.subproperty.bkcolor, color: alr.subproperty.color, toack: alr.isToAck() };
                    var toshow = true;
                    var canack = true;
                    if (alr.tagproperty && alr.tagproperty.permission) {
                        var mask = (alr.tagproperty.permission >> 8);
                        toshow = (mask) ? mask & groups : 1;
                        mask = (alr.tagproperty.permission & 255);
                        canack = (mask) ? mask & groups : 1;
                    }
                    if (toshow) {
                        if (!canack) {
                            alritem.toack = 0;
                        }
                        result.push(alritem);
                    }
                }
            });
        });
        return result;
    }

    this.getAlarmsString = function (type) {
        var result = '';
        Object.keys(alarms).forEach(alrkey => {
            alarms[alrkey].forEach(alr => {
                if (alr.status && alr.type === type && alr.ontime) {
                    var ontime = new Date(alr.ontime);
                    result += `${ontime.toLocaleString()} - ${alr.type} - ${alr.subproperty.text || ''} - ${alr.status} - ${alr.subproperty.group || ''}\n`;
                }
            });
        });
        return result;
    }

    /**
     * Return the alarms history
     */
    this.getAlarmsHistory = function (query, groups) {
        return new Promise(function (resolve, reject) {
            var history = [];
            alarmstorage.getAlarmsHistory(query.start, query.end).then(result => {
                for (var i = 0; i < result.length; i++) {
                    var alr = new AlarmHistory(result[i].nametype);
                    alr.status = result[i].status;
                    alr.text = result[i].text;
                    alr.ontime = result[i].ontime;
                    alr.offtime = result[i].offtime;
                    alr.acktime = result[i].acktime;
                    alr.userack = result[i].userack;
                    alr.group = result[i].grp;
                    if (alr.ontime) {
                        var toshow = true;
                        if (alarmsProperty[alr.name] && alarmsProperty[alr.name].property) {
                            var mask = (alarmsProperty[alr.name].property.permission >> 8);
                            var toshow = (mask) ? mask & groups : 1;    
                        }
                        if (toshow) {
                            history.push(alr);
                        }
                    }
                    // add action or defined colors
                    if (alr.type === AlarmsTypes.ACTION) {
                        alr.text = `${alr.name}`;
                        alr.group = `Actions`;
                    } else if (alarmsProperty[alr.name] && alarmsProperty[alr.name][alr.type]) {
                        alr.bkcolor = alarmsProperty[alr.name][alr.type].bkcolor;
                        alr.color = alarmsProperty[alr.name][alr.type].color;
                    }
                }
                resolve(history);
            }).catch(function (err) {
                logger.error('alarms.load-current.failed: ' + err);
                reject(err);
            });
        });
    }

    /**
     * Set Ack to alarm
     * @param {*} alarmName 
     * @returns 
     */
    this.setAlarmAck = function (alarmName, userId, groups) {
        return new Promise(function (resolve, reject) {
            var changed = [];
            var authError = false;
            Object.keys(alarms).forEach(alrkey => {
                alarms[alrkey].forEach(alr => {
                    if (alarmName === null || alr.getId() === alarmName) {
                        var mask = ((alr.tagproperty.permission >> 8) & 255);
                        var canack = (mask) ? mask & groups : 1;
                        if (canack) {
                            if (alr.isToAck() > 0) {
                                alr.setAck(userId);
                                changed.push(alr);
                            }
                        } else {
                            authError = true;
                        }
                    }
                });
            });
            if (authError) {
                reject({code: 401, error:"unauthorized_error", message: "Unauthorized!"});
            } else {
                if (changed.length) {
                    alarmstorage.setAlarms(changed).then(function (result) {
                        resolve(true);
                    }).catch(function (err) {
                        reject(err);
                    });
                } else {
                    resolve(false);
                }
            }
        });
    }

    this.clearAlarms = function (all) {
        return new Promise(function (resolve, reject) {
            alarmstorage.clearAlarms(all).then((result) => {
                resolve(true);
            }).catch(function (err) {
                reject(err);
            });
        });
    }

    /**
     * Clear Alarm history
     */
    this.checkRetention = function () {
        return new Promise(async function (resolve, reject) {
            if (settings.alarms && settings.alarms.retention !== 'none') {
                alarmstorage.clearAlarmsHistory(utils.getRetentionLimit(settings.alarms.retention)).then((result) => {
                    logger.info(`alarms.checkRetention processed`);
                    resolve(true);
                }).catch(function (err) {
                    reject(err);
                });
            } else {
                resolve();
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
                        _emitAlarmsChanged(true);
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
                var tag = devices.getDeviceValue(alarms[alrkey]['variableSource'], alrkey);
                if (tag !== null) {
                    groupalarms.forEach(alr => {
                        var value = _checkBitmask(alr, tag.value);
                        if (alr.check(time, tag.ts, value)) {
                            changed.push(alr);
                        }
                    });
                }
            });
            if (changed.length) {
                _checkActions(changed);
                alarmstorage.setAlarms(changed).then(function (result) {
                    changed.forEach(alr => {
                        if (alr.toremove) {
                            alr.init();
                        }
                    });
                    resolve(true);
                }).catch(function (err) {
                    reject(err);
                });
            } else {
                resolve(false);
            }
        });
    }

    var _checkBitmask = function(alarm, value) {
        if (alarm.tagproperty.bitmask) {
            return (value & alarm.tagproperty.bitmask) ? 1 : 0;
        }
        return Number(value);
    }

    /**
     * Init Alarm database
     */
    var _init = function () {
        return new Promise(function (resolve, reject) {
            alarmstorage.init(settings, logger).then(result => {
                logger.info('alarms.alarmstorage-init-successful!', true);
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
            alarmsProperty = {};
            runtime.project.getAlarms().then(function (result) {
                var alarmsFound = 0;
                if (result) {
                    result.forEach(alr => {
                        if (alr.property && alr.property.variableId) {
                            if (!alarms[alr.property.variableId]) {
                                alarms[alr.property.variableId] = [];
                                var deviceId = devices.getDeviceIdFromTag(alr.property.variableId);
                                if (deviceId) {
                                    // help for a fast get value
                                    alarms[alr.property.variableId]['variableSource'] = deviceId;
                                }
                            }
                            if (_isAlarmEnabled(alr.highhigh)) {
                                var alarm = new Alarm(alr.name, AlarmsTypes.HIGH_HIGH, alr.highhigh, alr.property);
                                alarms[alr.property.variableId].push(alarm);
                                alarmsFound++;
                            } 
                            if (_isAlarmEnabled(alr.high)) {
                                var alarm = new Alarm(alr.name, AlarmsTypes.HIGH, alr.high, alr.property);
                                alarms[alr.property.variableId].push(alarm);
                                alarmsFound++;
                            }
                            if (_isAlarmEnabled(alr.low)) {
                                var alarm = new Alarm(alr.name, AlarmsTypes.LOW, alr.low, alr.property);
                                alarms[alr.property.variableId].push(alarm);
                                alarmsFound++;
                            }
                            if (_isAlarmEnabled(alr.info)) {
                                var alarm = new Alarm(alr.name, AlarmsTypes.INFO, alr.info, alr.property);
                                alarms[alr.property.variableId].push(alarm);
                                alarmsFound++;
                            }
                            if (_isAlarmActionsEnabled(alr.actions)) {
                                for (var i = 0; i < alr.actions.values.length; i++) {
                                    if (_isActionsValid(alr.actions.values[i])) {
                                        var alarm = new Alarm(`${alr.name} - ${i}`, AlarmsTypes.ACTION, alr.actions.values[i], alr.property);
                                        alarms[alr.property.variableId].push(alarm);
                                        alarmsFound++;
                                        actionsProperty[alarm.getId()] = alarm;
                                    }

                                }
                            }
                            alarmsProperty[alr.name] = alr;
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

    var _checkActions = function (alarms) {
        for (var i = 0; i < alarms.length; i++) {
            if (alarms[i].type === AlarmsTypes.ACTION && alarms[i].subproperty && !alarms[i].offtime) {
                if (alarms[i].subproperty.type === ActionsTypes.SET_VALUE) {
                    var deviceId = devices.getDeviceIdFromTag(alarms[i].subproperty.variableId);
                    if (deviceId) {
                        devices.setDeviceValue(deviceId, alarms[i].subproperty.variableId, alarms[i].subproperty.actparam);
                    } else {
                        logger.error(`alarms.action.deviceId not found: ${alarms[i].name}`);
                    }
                }
            }
        }
    }
    
    var _checkWorking = function (check) {
        if (check && working) {
            logger.warn('alarms working (check) overload!');
            return false;
        }
        working = check;
        return true;
    }

    var _isAlarmEnabled = function (alarm) {
        if (alarm && alarm.enabled && alarm.checkdelay > 0 && utils.isValidRange(alarm.min, alarm.max)) {
            return true;
        }
        return false;
    }

    var _isAlarmActionsEnabled = function (alarm) {
        if (alarm && alarm.enabled && alarm.values && alarm.values.length > 0) {
            return true;
        }
        return false;
    }

    var _isActionsValid = function (action) {
        if (action && action.checkdelay > 0 && utils.isValidRange(action.min, action.max)) {
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
    this.userack;

    this.getId = function () {
        return this.name + '^~^' + this.type;
    }

    this.check = function (time, dt, value) {
        if (this.lastcheck + (this.subproperty.checkdelay * TimeMultiplier) > time) {
            return false;
        }
        this.lastcheck = time;
        this.toremove = false;
        var onrange = (value >= this.subproperty.min && value <= this.subproperty.max);
        switch(this.status) {
            case AlarmStatusEnum.VOID:
                //  check to activate
                if (!onrange) {
                    this.ontime = 0;
                    return false;
                } else if (!this.ontime) {
                    this.ontime = dt;
                    return false;
                }
                if (this.ontime + (this.subproperty.timedelay * TimeMultiplier) <= time) {
                    this.status = AlarmStatusEnum.ON;
                    return true;
                }
            case AlarmStatusEnum.ON:
                // check to deactivate
                if (!onrange) {
                    this.status = AlarmStatusEnum.OFF;
					if (this.offtime == 0) {
						this.offtime = time;
					}
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
					this.offtime = 0;
                    this.ontime = time;
                    this.userack = '';
                    return true;
                }
                // remove if acknowledged
                if (this.acktime || this.type === AlarmsTypes.ACTION) {
                    this.toRemove();
                    return true;
                }
                return false;
            case AlarmStatusEnum.ACK:
                // remove if deactivate
                if (!onrange) {
					if (this.offtime == 0) {
						this.offtime = time;
					}
                    this.status = AlarmStatusEnum.ON;
                    return true;
                }
                return false;
        }
    }

    this.init = function () {
        this.toremove = false;
        this.ontime = 0;
        this.offtime = 0;
        this.acktime = 0;
        this.status = AlarmStatusEnum.VOID;
        this.lastcheck = 0;
        this.userack = '';
    }

    this.toRemove = function () {
        this.toremove = true;
    }

    this.setAck = function (user) {
        if (!this.acktime) {
            this.acktime = new Date().getTime();
            this.lastcheck = 0;
            this.userack = user;
        }
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

function AlarmHistory(id) {
    this.name;
    this.type;
    this.laststatus;
    this.alarmtext;
    this.ontime = 0;
    this.offtime = 0;
    this.acktime = 0;
    this.userack;

    var ids = id.split('^~^');
    this.name = ids[0];
    this.type = ids[1];
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

const AlarmsTypes = {
    HIGH_HIGH: 'highhigh',
    HIGH: 'high',
    LOW: 'low',
    INFO: 'info',
    ACTION: 'action'
}

const ActionsTypes = {
    POPUP: 'popup',
    SET_VALUE: 'setValue',
    SET_VIEW: 'setView',
    SEND_MSG: 'sendMsg'
}
