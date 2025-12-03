/**
 * 'api/parameters-table': Parameters Table API to GET/POST parameters data
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
                const storage = {
                    storageType: req.query.storageType || 'sqlite',
                    odbcDeviceId: req.query.odbcDeviceId
                };
                runtime.parametersStorage.setStorage(storage);
                runtime.parametersStorage.getParameterTypes().then(types => {
                    res.json({ types: types || [] });
                }).catch(err => {
                    runtime.logger.error("get parameter types error! " + err);
                    res.status(400).json({ error: err });
                });
            } catch (err) {
                runtime.logger.error("get parameter types error! " + err);
                res.status(400).json({ error: err });
            }
        });

        // POST parameter type
        parametersApp.post("/api/parameters-table/types", secureFnc, function(req, res) {
            try {
                if (req.body && req.body.type) {
                    const storage = req.body.storage || {storageType: 'sqlite', odbcDeviceId: null};
                    runtime.parametersStorage.setStorage(storage);
                    var parameterType = req.body.type;

                    runtime.parametersStorage.saveParameterType(parameterType).then(result => {
                        runtime.logger.info('[API POST PARAMETER TYPE] Data saved successfully');
                        res.json({ result: 'ok' });
                    }).catch(err => {
                        runtime.logger.error("save parameter type error! " + err);
                        res.status(400).json({ error: err });
                    });
                } else {
                    res.status(400).json({ error: 'Missing parameter type in request body' });
                }
            } catch (err) {
                runtime.logger.error("save parameter type error! " + err);
                res.status(400).json({ error: err });
            }
        });

        // DELETE parameter type
        parametersApp.delete("/api/parameters-table/types", secureFnc, function(req, res) {
            try {
                if (req.query && req.query.id) {
                    const storage = {
                        storageType: req.query.storageType || 'sqlite',
                        odbcDeviceId: req.query.odbcDeviceId
                    };
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
                res.status(400).json({ error: err.toString() });
            }
        });

        // GET parameter sets for a type
        parametersApp.get("/api/parameters-table/sets", secureFnc, function(req, res) {
            try {
                if (req.query && req.query.typeId) {
                    const storage = {
                        storageType: req.query.storageType || 'sqlite',
                        odbcDeviceId: req.query.odbcDeviceId
                    };
                    runtime.parametersStorage.setStorage(storage);
                    var typeId = req.query.typeId;
                    runtime.parametersStorage.getParameterSets(typeId).then(sets => {
                        res.json({ sets: sets || [] });
                    }).catch(err => {
                        runtime.logger.error("get parameter sets error! " + err);
                        res.status(400).json({ error: err });
                    });
                } else {
                    res.status(400).json({ error: 'Missing typeId parameter' });
                }
            } catch (err) {
                runtime.logger.error("get parameter sets error! " + err);
                res.status(400).json({ error: err });
            }
        });

        // GET single parameter set by ID
        parametersApp.get("/api/parameters-table/set/:id", secureFnc, function(req, res) {
            try {
                const storage = {
                    storageType: req.query.storageType || 'sqlite',
                    odbcDeviceId: req.query.odbcDeviceId
                };
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
                    res.status(400).json({ error: err });
                });
            } catch (err) {
                runtime.logger.error("get parameter set error! " + err);
                res.status(400).json({ error: err });
            }
        });

        // POST parameter set
        parametersApp.post("/api/parameters-table/sets", secureFnc, function(req, res) {
            try {
                if (req.body && req.body.set) {
                    const storage = req.body.storage || {storageType: 'sqlite', odbcDeviceId: null};
                    runtime.parametersStorage.setStorage(storage);
                    var parameterSet = req.body.set;

                    runtime.parametersStorage.saveParameterSet(parameterSet).then(result => {
                        runtime.logger.info('[API POST PARAMETER SET] Data saved successfully');
                        res.json({ result: 'ok' });
                    }).catch(err => {
                        runtime.logger.error("save parameter set error! " + err);
                        res.status(400).json({ error: err });
                    });
                } else {
                    res.status(400).json({ error: 'Missing parameter set in request body' });
                }
            } catch (err) {
                runtime.logger.error("save parameter set error! " + err);
                res.status(400).json({ error: err });
            }
        });

        // PUT parameter set (update existing)
        parametersApp.put("/api/parameters-table/sets/:id", secureFnc, function(req, res) {
            try {
                if (req.body && req.body.set) {
                    const storage = req.body.storage || {storageType: 'sqlite', odbcDeviceId: null};
                    runtime.parametersStorage.setStorage(storage);
                    var parameterSet = req.body.set;
                    var setId = req.params.id;

                    // Ensure the set ID matches the URL parameter
                    parameterSet.id = setId;

                    runtime.parametersStorage.saveParameterSet(parameterSet).then(result => {
                        runtime.logger.info('[API PUT PARAMETER SET] Data updated successfully');
                        res.json({ result: 'ok' });
                    }).catch(err => {
                        runtime.logger.error("update parameter set error! " + err);
                        res.status(400).json({ error: err });
                    });
                } else {
                    res.status(400).json({ error: 'Missing parameter set in request body' });
                }
            } catch (err) {
                runtime.logger.error("update parameter set error! " + err);
                res.status(400).json({ error: err });
            }
        });

        // DELETE parameter set
        parametersApp.delete("/api/parameters-table/sets", secureFnc, function(req, res) {
            try {
                if (req.query && req.query.id) {
                    const storage = {
                        storageType: req.query.storageType || 'sqlite',
                        odbcDeviceId: req.query.odbcDeviceId
                    };
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
                res.status(400).json({ error: err.toString() });
            }
        });

        // POST export parameter type with sets
        parametersApp.post("/api/parameters-table/export", secureFnc, function(req, res) {
            try {
                if (req.body && req.body.typeId) {
                    const storage = req.body.storage || {storageType: 'sqlite', odbcDeviceId: null};
                    runtime.parametersStorage.setStorage(storage);
                    var typeId = req.body.typeId;

                    runtime.parametersStorage.exportParameterType(typeId).then(data => {
                        res.json({ data: data });
                    }).catch(err => {
                        runtime.logger.error("export parameter type error! " + err);
                        res.status(400).json({ error: err });
                    });
                } else {
                    res.status(400).json({ error: 'Missing typeId in request body' });
                }
            } catch (err) {
                runtime.logger.error("export parameter type error! " + err);
                res.status(400).json({ error: err });
            }
        });

        // POST import parameter type with sets
        parametersApp.post("/api/parameters-table/import", secureFnc, function(req, res) {
            try {
                if (req.body && req.body.data) {
                    const storage = req.body.storage || {storageType: 'sqlite', odbcDeviceId: null};
                    runtime.parametersStorage.setStorage(storage);
                    var importData = req.body.data;

                    runtime.parametersStorage.importParameterType(importData).then(result => {
                        runtime.logger.info('[API POST PARAMETER IMPORT] Data imported successfully');
                        res.json({ result: 'ok' });
                    }).catch(err => {
                        runtime.logger.error("import parameter type error! " + err);
                        res.status(400).json({ error: err });
                    });
                } else {
                    res.status(400).json({ error: 'Missing data in request body' });
                }
            } catch (err) {
                runtime.logger.error("import parameter type error! " + err);
                res.status(400).json({ error: err });
            }
        });

        return parametersApp;
    }
};