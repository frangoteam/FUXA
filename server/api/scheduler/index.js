/**
 * 'api/scheduler': Scheduler API to GET/POST scheduler data
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
        var schedulerApp = express();
        schedulerApp.use(function (req, res, next) {
            if (!runtime.project) {
                res.status(404).end();
            } else {
                next();
            }
        });
        
        // GET scheduler data
        schedulerApp.get("/api/scheduler", secureFnc, function(req, res) {
            try {
                if (req.query && req.query.id) {
                    var schedulerId = req.query.id;
                    runtime.schedulerStorage.getSchedulerData(schedulerId).then(result => {
                        if (result) {
                            res.json(result);
                        } else {
                            res.json({ schedules: {} });
                        }
                    }).catch(err => {
                        runtime.logger.error("get scheduler data error! " + err);
                        res.status(400).json({ error: err });
                    });
                } else {
                    res.status(400).json({ error: 'Missing scheduler id parameter' });
                }
            } catch (err) {
                runtime.logger.error("get scheduler data error! " + err);
                res.status(400).json({ error: err });
            }
        });

        // POST scheduler data
        schedulerApp.post("/api/scheduler", secureFnc, function(req, res) {
            try {
                if (req.body && req.body.id && req.body.data !== undefined) {
                    var schedulerId = req.body.id;
                    var schedulerData = req.body.data;
                    
                    // LOG INCOMING DATA
                    runtime.logger.info('[API POST SCHEDULER] Received data for scheduler: ' + schedulerId);
                    runtime.logger.info('[API POST SCHEDULER] Settings: ' + JSON.stringify(schedulerData.settings, null, 2));
                    runtime.logger.info('[API POST SCHEDULER] Device Actions: ' + JSON.stringify(schedulerData.settings?.deviceActions, null, 2));
                    
                    const validation = validateSchedulerData(schedulerData);
                    if (!validation.valid) {
                        runtime.logger.error("Invalid scheduler data: " + validation.error);
                        return res.status(400).json({ error: 'Invalid scheduler data: ' + validation.error });
                    }
                    
                    runtime.schedulerStorage.getSchedulerData(schedulerId).then(oldData => {
                        return runtime.schedulerStorage.setSchedulerData(schedulerId, schedulerData).then(result => {
                            runtime.logger.info('[API POST SCHEDULER] Data saved successfully to database');
                            res.json({ result: 'ok' });
                            if (runtime.schedulerService) {
                                runtime.schedulerService.updateScheduler(schedulerId, schedulerData, oldData);
                            }
                        });
                    }).catch(err => {
                        runtime.logger.error("set scheduler data error! " + err);
                        res.status(400).json({ error: err });
                    });
                } else {
                    res.status(400).json({ error: 'Missing scheduler id or data in request body' });
                }
            } catch (err) {
                runtime.logger.error("set scheduler data error! " + err);
                res.status(400).json({ error: err });
            }
        });

        // DELETE scheduler data
        schedulerApp.delete("/api/scheduler", secureFnc, function(req, res) {
            try {
                if (req.query && req.query.id) {
                    var schedulerId = req.query.id;
                    
                    if (runtime.schedulerService && runtime.schedulerService.removeScheduler) {
                        runtime.schedulerService.removeScheduler(schedulerId).then(() => {
                            return runtime.schedulerStorage.deleteSchedulerData(schedulerId);
                        }).then(result => {
                            res.json({ result: 'ok', deleted: result.changes });
                        }).catch(err => {
                            runtime.logger.error("delete scheduler error! " + err);
                            res.status(400).json({ error: err.toString() });
                        });
                    } else {
                        runtime.schedulerStorage.deleteSchedulerData(schedulerId).then(result => {
                            res.json({ result: 'ok', deleted: result.changes });
                        }).catch(err => {
                            runtime.logger.error("delete scheduler data error! " + err);
                            res.status(400).json({ error: err.toString() });
                        });
                    }
                } else {
                    res.status(400).json({ error: 'Missing scheduler id parameter' });
                }
            } catch (err) {
                runtime.logger.error("delete scheduler error! " + err);
                res.status(400).json({ error: err.toString() });
            }
        });

        return schedulerApp;
    }
};

// Validate scheduler data structure
function validateSchedulerData(data) {
    if (!data || typeof data !== 'object') {
        return { valid: false, error: 'Data must be an object' };
    }
    
    if (!data.schedules || typeof data.schedules !== 'object') {
        return { valid: false, error: 'Missing or invalid schedules object' };
    }
    
    if (!data.settings || typeof data.settings !== 'object') {
        return { valid: false, error: 'Missing or invalid settings object' };
    }
    
    if (!data.settings.devices || !Array.isArray(data.settings.devices)) {
        return { valid: false, error: 'Missing or invalid settings.devices array' };
    }
    
    const deviceNames = new Set();
    for (let device of data.settings.devices) {
        if (!device.name || typeof device.name !== 'string') {
            return { valid: false, error: 'Device missing name property' };
        }
        if (!device.variableId || typeof device.variableId !== 'string') {
            return { valid: false, error: `Device "${device.name}" missing variableId` };
        }
        deviceNames.add(device.name);
    }
    
    for (let deviceName in data.schedules) {
        if (!deviceNames.has(deviceName)) {
            console.warn(`Warning: Schedule exists for "${deviceName}" but device not found in settings.devices`);
        }
        
        const schedules = data.schedules[deviceName];
        if (!Array.isArray(schedules)) {
            return { valid: false, error: `Schedules for "${deviceName}" must be an array` };
        }
        
        for (let i = 0; i < schedules.length; i++) {
            const schedule = schedules[i];
            
            if (!schedule.startTime) {
                return { valid: false, error: `Schedule ${i} for "${deviceName}" missing startTime` };
            }
            
            if (!schedule.days || !Array.isArray(schedule.days) || schedule.days.length !== 7) {
                return { valid: false, error: `Schedule ${i} for "${deviceName}" missing or invalid days array` };
            }
            
            if (schedule.deviceName !== deviceName) {
                console.warn(`Warning: Schedule.deviceName "${schedule.deviceName}" doesn't match key "${deviceName}"`);
            }
        }
    }
    
    return { valid: true };
}