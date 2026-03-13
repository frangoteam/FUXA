/**
 * 'api/parameters-table': Parameters Table API with security validation
 */

var express = require("express");
const authJwt = require('../jwt-helper');

var runtime;
var secureFnc;
var checkGroupsFnc;

// Validate storage type and device access
function validateAndResolveStorage(storageConfig, userId, permission, logger) {
    const storageType = storageConfig?.storageType || 'sqlite';
    
    if (!['sqlite', 'odbc'].includes(storageType)) {
        logger.error(`Invalid storage type: ${storageType}`);
        throw new Error(`Invalid storage type: ${storageType}`);
    }
    
    const resolvedStorage = { storageType };
    
    if (storageType === 'odbc') {
        if (!storageConfig?.odbcDeviceId) {
            logger.error(`ODBC device ID required`);
            throw new Error('ODBC device ID required');
        }
        
        const deviceId = storageConfig.odbcDeviceId;
        logger.debug(`Validating ODBC device: ${deviceId}`);
        const device = runtime.project.getDeviceById(deviceId);
        
        if (!device) {
            const allDevices = runtime.project.getDevices ? Object.keys(runtime.project.getDevices()) : 'N/A';
            logger.error(`Device not found: ${deviceId}. Available devices: ${JSON.stringify(allDevices)}`);
            throw new Error(`Device not found: ${deviceId}`);
        }
        
        if (device.type !== 'ODBC') {
            logger.error(`Device ${deviceId} is not ODBC type: ${device.type}`);
            throw new Error(`Device is not ODBC type: ${device.type}`);
        }
        
        if (device.secured && device.secured.length > 0) {
            const userGroups = permission?.groups || [];
            const hasAccess = device.secured.some(group => userGroups.includes(group));
            if (!hasAccess && !authJwt.haveAdminPermission(permission)) {
                logger.warn(`User ${userId} denied access to device: ${deviceId}`);
                throw new Error('Access denied to device');
            }
        }
        
        resolvedStorage.odbcDeviceId = deviceId;
    }
    
    return resolvedStorage;
}

module.exports = {
    init: function (_runtime, _secureFnc, _checkGroupsFnc) {
        runtime = _runtime;
        secureFnc = _secureFnc;
        checkGroupsFnc = _checkGroupsFnc;
    },
    app: function () {
        var parametersApp = express();
        parametersApp.use(function (req, res, next) {
            if (!runtime.project) {
                res.status(404).end();
            } else {
                next();
            }
        });

        // GET parameter types
        parametersApp.get("/api/parameters-table/types", secureFnc, function(req, res) {
            try {
                const permission = checkGroupsFnc(req);
                if (!permission) {
                    return res.status(403).json({ error: 'Unauthorized' });
                }
                
                let storage = { storageType: 'sqlite' };
                if (req.query.storageType === 'odbc' && req.query.odbcDeviceId) {
                    storage = validateAndResolveStorage(
                        { storageType: req.query.storageType, odbcDeviceId: req.query.odbcDeviceId },
                        req.userId,
                        permission,
                        runtime.logger
                    );
                }
                
                runtime.parametersStorage.setStorage(storage);
                runtime.parametersStorage.getParameterTypes().then(types => {
                    res.json({ types: types || [] });
                }).catch(err => {
                    runtime.logger.error("get parameter types error! " + err.message);
                    res.status(400).json({ error: err.message || 'Error retrieving types' });
                });
            } catch (err) {
                runtime.logger.error("get parameter types error! " + err.message);
                res.status(400).json({ error: err.message || 'Error retrieving types' });
            }
        });

        // POST parameter type
        parametersApp.post("/api/parameters-table/types", secureFnc, function(req, res) {
            try {
                const permission = checkGroupsFnc(req);
                if (!permission) {
                    return res.status(403).json({ error: 'Unauthorized: invalid or missing authorization' });
                }
                
                if (req.body && req.body.type) {
                    let storage = req.body.storage || { storageType: 'sqlite' };
                    if (storage.storageType === 'odbc' && storage.odbcDeviceId) {
                        storage = validateAndResolveStorage(
                            storage,
                            req.userId,
                            permission,
                            runtime.logger
                        );
                    }
                    
                    runtime.parametersStorage.setStorage(storage);
                    var parameterType = req.body.type;

                    runtime.parametersStorage.saveParameterType(parameterType).then(result => {
                        res.json({ result: 'ok' });
                    }).catch(err => {
                        runtime.logger.error("save parameter type error! " + err);
                        res.status(400).json({ error: err.message || err });
                    });
                } else {
                    res.status(400).json({ error: 'Missing parameter type in request body' });
                }
            } catch (err) {
                runtime.logger.error("save parameter type error! " + err);
                res.status(400).json({ error: err.message || err });
            }
        });

        // DELETE parameter type
        parametersApp.delete("/api/parameters-table/types", secureFnc, function(req, res) {
            try {
                const permission = checkGroupsFnc(req);
                if (!permission) {
                    return res.status(403).json({ error: 'Unauthorized: invalid or missing authorization' });
                }
                
                if (req.query && req.query.id) {
                    let storage = { storageType: 'sqlite' };
                    if (req.query.storageType === 'odbc' && req.query.odbcDeviceId) {
                        storage = validateAndResolveStorage(
                            { storageType: req.query.storageType, odbcDeviceId: req.query.odbcDeviceId },
                            req.userId,
                            permission,
                            runtime.logger
                        );
                    }
                    
                    runtime.parametersStorage.setStorage(storage);
                    var typeId = req.query.id;

                    runtime.parametersStorage.deleteParameterType(typeId).then(result => {
                        res.json({ result: 'ok', deleted: result.changes });
                    }).catch(err => {
                        runtime.logger.error("delete parameter type error! " + err);
                        res.status(400).json({ error: err.toString() });
                    });
                } else {
                    res.status(400).json({ error: 'Missing type id parameter' });
                }
            } catch (err) {
                runtime.logger.error("delete parameter type error! " + err);
                res.status(400).json({ error: err.message || err.toString() });
            }
        });

        // GET parameter sets for a type
        parametersApp.get("/api/parameters-table/sets", secureFnc, function(req, res) {
            try {
                const permission = checkGroupsFnc(req);
                if (!permission) {
                    return res.status(403).json({ error: 'Unauthorized: invalid or missing authorization' });
                }
                
                if (req.query && req.query.typeId) {
                    let storage = { storageType: 'sqlite' };
                    if (req.query.storageType === 'odbc' && req.query.odbcDeviceId) {
                        storage = validateAndResolveStorage(
                            { storageType: req.query.storageType, odbcDeviceId: req.query.odbcDeviceId },
                            req.userId,
                            permission,
                            runtime.logger
                        );
                    }
                    
                    runtime.parametersStorage.setStorage(storage);
                    var typeId = req.query.typeId;
                    runtime.parametersStorage.getParameterSets(typeId).then(sets => {
                        res.json({ sets: sets || [] });
                    }).catch(err => {
                        runtime.logger.error("get parameter sets error! " + err);
                        res.status(400).json({ error: err.message || err });
                    });
                } else {
                    res.status(400).json({ error: 'Missing typeId parameter' });
                }
            } catch (err) {
                runtime.logger.error("get parameter sets error! " + err);
                res.status(400).json({ error: err.message || err });
            }
        });

        // GET single parameter set by ID
        parametersApp.get("/api/parameters-table/set/:id", secureFnc, function(req, res) {
            try {
                const permission = checkGroupsFnc(req);
                if (!permission) {
                    return res.status(403).json({ error: 'Unauthorized: invalid or missing authorization' });
                }
                
                let storage = { storageType: 'sqlite' };
                if (req.query.storageType === 'odbc' && req.query.odbcDeviceId) {
                    storage = validateAndResolveStorage(
                        { storageType: req.query.storageType, odbcDeviceId: req.query.odbcDeviceId },
                        req.userId,
                        permission,
                        runtime.logger
                    );
                }
                
                runtime.parametersStorage.setStorage(storage);
                var setId = req.params.id;
                runtime.parametersStorage.getParameterSet(setId).then(set => {
                    if (set) {
                        res.json({ set: set });
                    } else {
                        res.status(404).json({ error: 'Parameter set not found' });
                    }
                }).catch(err => {
                    runtime.logger.error("get parameter set error! " + err);
                    res.status(400).json({ error: err.message || err });
                });
            } catch (err) {
                runtime.logger.error("get parameter set error! " + err);
                res.status(400).json({ error: err.message || err });
            }
        });

        // POST parameter set
        parametersApp.post("/api/parameters-table/sets", secureFnc, function(req, res) {
            try {
                const permission = checkGroupsFnc(req);
                if (!permission) {
                    return res.status(403).json({ error: 'Unauthorized: invalid or missing authorization' });
                }
                
                if (req.body && req.body.set) {
                    let storage = req.body.storage || { storageType: 'sqlite' };
                    if (storage.storageType === 'odbc' && storage.odbcDeviceId) {
                        storage = validateAndResolveStorage(
                            storage,
                            req.userId,
                            permission,
                            runtime.logger
                        );
                    }
                    
                    runtime.parametersStorage.setStorage(storage);
                    var parameterSet = req.body.set;

                    runtime.parametersStorage.saveParameterSet(parameterSet).then(result => {
                        res.json({ result: 'ok' });
                    }).catch(err => {
                        runtime.logger.error("save parameter set error! " + err);
                        res.status(400).json({ error: err.message || err });
                    });
                } else {
                    res.status(400).json({ error: 'Missing parameter set in request body' });
                }
            } catch (err) {
                runtime.logger.error("save parameter set error! " + err);
                res.status(400).json({ error: err.message || err });
            }
        });

        // PUT parameter set (update existing)
        parametersApp.put("/api/parameters-table/sets/:id", secureFnc, function(req, res) {
            try {
                const permission = checkGroupsFnc(req);
                if (!permission) {
                    return res.status(403).json({ error: 'Unauthorized: invalid or missing authorization' });
                }
                
                if (req.body && req.body.set) {
                    let storage = req.body.storage || { storageType: 'sqlite' };
                    if (storage.storageType === 'odbc' && storage.odbcDeviceId) {
                        storage = validateAndResolveStorage(
                            storage,
                            req.userId,
                            permission,
                            runtime.logger
                        );
                    }
                    
                    runtime.parametersStorage.setStorage(storage);
                    var parameterSet = req.body.set;
                    var setId = req.params.id;

                    parameterSet.id = setId;

                    runtime.parametersStorage.saveParameterSet(parameterSet).then(result => {
                        res.json({ result: 'ok' });
                    }).catch(err => {
                        runtime.logger.error("update parameter set error! " + err);
                        res.status(400).json({ error: err.message || err });
                    });
                } else {
                    res.status(400).json({ error: 'Missing parameter set in request body' });
                }
            } catch (err) {
                runtime.logger.error("update parameter set error! " + err);
                res.status(400).json({ error: err.message || err });
            }
        });

        // DELETE parameter set
        parametersApp.delete("/api/parameters-table/sets", secureFnc, function(req, res) {
            try {
                const permission = checkGroupsFnc(req);
                if (!permission) {
                    return res.status(403).json({ error: 'Unauthorized: invalid or missing authorization' });
                }
                
                if (req.query && req.query.id) {
                    let storage = { storageType: 'sqlite' };
                    if (req.query.storageType === 'odbc' && req.query.odbcDeviceId) {
                        storage = validateAndResolveStorage(
                            { storageType: req.query.storageType, odbcDeviceId: req.query.odbcDeviceId },
                            req.userId,
                            permission,
                            runtime.logger
                        );
                    }
                    
                    runtime.parametersStorage.setStorage(storage);
                    var setId = req.query.id;

                    runtime.parametersStorage.deleteParameterSet(setId).then(result => {
                        res.json({ result: 'ok', deleted: result.changes });
                    }).catch(err => {
                        runtime.logger.error("delete parameter set error! " + err);
                        res.status(400).json({ error: err.toString() });
                    });
                } else {
                    res.status(400).json({ error: 'Missing set id parameter' });
                }
            } catch (err) {
                runtime.logger.error("delete parameter set error! " + err);
                res.status(400).json({ error: err.message || err.toString() });
            }
        });

        // POST export parameter type with sets
        parametersApp.post("/api/parameters-table/export", secureFnc, function(req, res) {
            try {
                const permission = checkGroupsFnc(req);
                if (!permission) {
                    return res.status(403).json({ error: 'Unauthorized: invalid or missing authorization' });
                }
                
                if (req.body && req.body.typeId) {
                    let storage = req.body.storage || { storageType: 'sqlite' };
                    if (storage.storageType === 'odbc' && storage.odbcDeviceId) {
                        storage = validateAndResolveStorage(
                            storage,
                            req.userId,
                            permission,
                            runtime.logger
                        );
                    }
                    
                    runtime.parametersStorage.setStorage(storage);
                    var typeId = req.body.typeId;

                    runtime.parametersStorage.exportParameterType(typeId).then(data => {
                        res.json({ data: data });
                    }).catch(err => {
                        runtime.logger.error("export parameter type error! " + err);
                        res.status(400).json({ error: err.message || err });
                    });
                } else {
                    res.status(400).json({ error: 'Missing typeId in request body' });
                }
            } catch (err) {
                runtime.logger.error("export parameter type error! " + err);
                res.status(400).json({ error: err.message || err });
            }
        });

        // POST import parameter type with sets
        parametersApp.post("/api/parameters-table/import", secureFnc, function(req, res) {
            try {
                const permission = checkGroupsFnc(req);
                if (!permission) {
                    return res.status(403).json({ error: 'Unauthorized: invalid or missing authorization' });
                }
                
                if (req.body && req.body.data) {
                    let storage = req.body.storage || { storageType: 'sqlite' };
                    if (storage.storageType === 'odbc' && storage.odbcDeviceId) {
                        storage = validateAndResolveStorage(
                            storage,
                            req.userId,
                            permission,
                            runtime.logger
                        );
                    }
                    
                    runtime.parametersStorage.setStorage(storage);
                    var importData = req.body.data;

                    runtime.parametersStorage.importParameterType(importData).then(result => {
                        res.json({ result: 'ok' });
                    }).catch(err => {
                        runtime.logger.error("import parameter type error! " + err);
                        res.status(400).json({ error: err.message || err });
                    });
                } else {
                    res.status(400).json({ error: 'Missing data in request body' });
                }
            } catch (err) {
                runtime.logger.error("import parameter type error! " + err);
                res.status(400).json({ error: err.message || err });
            }
        });

        return parametersApp;
    }
};