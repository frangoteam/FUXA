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
                    const permission = checkGroupsFnc(req);
                    Promise.all([
                        runtime.schedulerStorage.getSchedulerData(schedulerId),
                        getSchedulerControl(schedulerId, permission)
                    ]).then(([result, control]) => {
                        const access = getResourcePermission(permission, control?.property);
                        if (!access.show) {
                            return res.status(403).json({error:"unauthorized_error", message: "Forbidden!"});
                        }
                        if (result && control?.property?.devices && runtime.checkPermission) {
                            const visibleDevices = new Set(control.property.devices
                                .filter(device => getResourcePermission(permission, device).show)
                                .map(device => device.name || device.label));
                            result = Object.assign({}, result, {
                                settings: Object.assign({}, result.settings, {
                                    devices: (result.settings?.devices || []).filter(device => visibleDevices.has(device.name)),
                                    deviceActions: (result.settings?.deviceActions || []).filter(action => visibleDevices.has(action.deviceName))
                                }),
                                schedules: Object.fromEntries(Object.entries(result.schedules || {})
                                    .filter(([deviceName]) => visibleDevices.has(deviceName)))
                            });
                        }
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
            if (res.statusCode === 403) {
                runtime.logger.error("api post scheduler: Tocken Expired");
                return;
            }
            const permission = checkGroupsFnc(req);
            const isGuest = authJwt.isGuestUser(req.userId, req.userGroups);
            const isAdmin = authJwt.haveAdminPermission(permission);
            if (runtime.settings?.secureEnabled && isGuest) {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api post scheduler: authentication required");
                return;
            }
            try {
                if (req.body && req.body.id && req.body.data !== undefined) {
                    var schedulerId = req.body.id;
                    var schedulerData = req.body.data;
                    
                    // LOG INCOMING DATA
                    runtime.logger.info('[API POST SCHEDULER] Received data for scheduler: ' + schedulerId);
                    runtime.logger.info('[API POST SCHEDULER] Settings: ' + JSON.stringify(schedulerData.settings, null, 2));
                    runtime.logger.info('[API POST SCHEDULER] Device Actions: ' + JSON.stringify(schedulerData.settings?.deviceActions, null, 2));

                    Promise.all([
                        runtime.schedulerStorage.getSchedulerData(schedulerId),
                        getSchedulerControl(schedulerId, permission)
                    ]).then(([oldData, control]) => {
                        const controlPermission = getResourcePermission(permission, control?.property);
                        if (runtime.settings?.secureEnabled && !isAdmin &&
                            (!controlPermission.show || !controlPermission.enabled)) {
                            runtime.logger.error("api post scheduler: scheduler permission required");
                            res.status(403).json({error:"unauthorized_error", message: "Forbidden!"});
                            return null;
                        }
                        if (runtime.settings?.secureEnabled && !isAdmin) {
                            const trustedSettings = oldData?.settings || {
                                eventMode: !!schedulerData.settings?.eventMode,
                                devices: control?.property?.devices || [],
                                deviceActions: control?.property?.deviceActions || []
                            };
                            schedulerData = Object.assign({}, oldData || {}, {
                                schedules: schedulerData.schedules || {},
                                settings: trustedSettings
                            });
                            const devicePermissions = new Map((control?.property?.devices || oldData?.settings?.devices || [])
                                .map(device => [device.name || device.label, getResourcePermission(permission, device)]));
                            const changedDeviceNames = new Set([
                                ...Object.keys(oldData?.schedules || {}),
                                ...Object.keys(schedulerData.schedules || {})
                            ].filter(deviceName => JSON.stringify(oldData?.schedules?.[deviceName] || []) !==
                                JSON.stringify(schedulerData.schedules?.[deviceName] || [])));
                            for (const deviceName of changedDeviceNames) {
                                const devicePermission = devicePermissions.get(deviceName);
                                if (!controlPermission.enabled || !devicePermission?.show || !devicePermission?.enabled) {
                                    res.status(403).json({error:"unauthorized_error", message: "Forbidden!"});
                                    return null;
                                }
                            }
                        }

                        const validation = validateSchedulerData(schedulerData);
                        if (!validation.valid) {
                            runtime.logger.error("Invalid scheduler data: " + validation.error);
                            res.status(400).json({ error: 'Invalid scheduler data: ' + validation.error });
                            return null;
                        }

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
            if (res.statusCode === 403) {
                runtime.logger.error("api delete scheduler: Tocken Expired");
                return;
            }
            const permission = checkGroupsFnc(req);
            const isGuest = authJwt.isGuestUser(req.userId, req.userGroups);
            const isAdmin = authJwt.haveAdminPermission(permission);
            if (runtime.settings?.secureEnabled && isGuest) {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api delete scheduler: authentication required");
                return;
            }
            try {
                if (req.query && req.query.id) {
                    var schedulerId = req.query.id;
                    Promise.all([
                        getSchedulerControl(schedulerId, permission),
                        runtime.schedulerStorage.getSchedulerData(schedulerId)
                    ]).then(async ([control, schedulerData]) => {
                        if (runtime.settings?.secureEnabled && !isAdmin) {
                            const access = getResourcePermission(permission, control?.property);
                            const devices = [
                                ...(control?.property?.devices || []),
                                ...(schedulerData?.settings?.devices || [])
                            ];
                            const canDelete = access.show && access.enabled && devices.every(device => {
                                const deviceAccess = getResourcePermission(permission, device);
                                return deviceAccess.show && deviceAccess.enabled;
                            });
                            if (!canDelete) {
                                runtime.logger.error("api delete scheduler: scheduler permission required");
                                return res.status(403).json({error:"unauthorized_error", message: "Forbidden!"});
                            }
                        }

                        if (runtime.schedulerService && runtime.schedulerService.removeScheduler) {
                            await runtime.schedulerService.removeScheduler(schedulerId);
                        }
                        const result = await runtime.schedulerStorage.deleteSchedulerData(schedulerId);
                        res.json({ result: 'ok', deleted: result.changes });
                    }).catch(err => {
                        runtime.logger.error("delete scheduler error! " + err);
                        res.status(400).json({ error: err.toString() });
                    });
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

async function getSchedulerControl(schedulerId, permission) {
    if (!runtime.project || typeof runtime.project.getProject !== 'function') {
        return null;
    }
    const project = await runtime.project.getProject(null, permission);
    for (const view of project?.hmi?.views || []) {
        for (const item of Object.values(view.items || {})) {
            if (item?.id === schedulerId) {
                return item;
            }
        }
    }
    return null;
}

function getResourcePermission(permission, resource) {
    if (!resource || typeof resource !== 'object') {
        return { show: false, enabled: false };
    }
    if (runtime.checkPermission) {
        return runtime.checkPermission(permission, resource, false, true);
    }
    if (runtime.settings?.secureEnabled) {
        return { show: false, enabled: false };
    }
    // Keep compatibility with runtimes/test fixtures that do not expose project
    // permissions when security is disabled.
    return { show: true, enabled: true };
}

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
