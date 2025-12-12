/**
 * Module to manage parameters table configuration storage
 */

'use strict';

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

var settings;
var logger;
var runtime;
var parametersDB;
var currentStorage = { storageType: 'sqlite', odbcDeviceId: null };

var TABLE_TYPES = 'parameter_types';
var TABLE_SETS = 'parameter_sets';

function init(_settings, _log, _runtime) {
    settings = _settings;
    logger = _log;
    runtime = _runtime;
    currentStorage = { storageType: 'sqlite', odbcDeviceId: null };

    return new Promise((resolve, reject) => {
        try {
            _createDB().then(() => {
                resolve();
            }).catch(err => {
                logger.error('parameters-storage init error: ' + err);
                reject(err);
            });
        } catch (err) {
            logger.error('parameters-storage init error: ' + err);
            reject(err);
        }
    });
}

function setStorage(storage) {
    currentStorage = { storageType: storage.storageType || 'sqlite', odbcDeviceId: storage.odbcDeviceId };
}

function _ensureTables() {
    return new Promise((resolve, reject) => {
        if (currentStorage.storageType === 'odbc') {
            const device = runtime.devices.getDevice(currentStorage.odbcDeviceId, true);
            if (!device) {
                logger.error('ODBC device not found');
                reject(new Error('ODBC device not found'));
                return;
            }
            const createTypesTableSQL = `CREATE TABLE IF NOT EXISTS ${TABLE_TYPES} (id TEXT PRIMARY KEY, data TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`;
            const createSetsTableSQL = `CREATE TABLE IF NOT EXISTS ${TABLE_SETS} (id TEXT PRIMARY KEY, type_id TEXT NOT NULL, data TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (type_id) REFERENCES ${TABLE_TYPES} (id) ON DELETE CASCADE)`;
            device.executeSqliteQuery(createTypesTableSQL).then(() => {
                device.executeSqliteQuery(createSetsTableSQL).then(() => {
                    resolve();
                }).catch(reject);
            }).catch(reject);
        } else {
            if (!parametersDB) {
                _createDB().then(resolve).catch(reject);
            } else {
                resolve();
            }
        }
    });
}

function _createDB() {
    return new Promise((resolve, reject) => {
        const dbPath = path.join(settings.workDir, 'parameters.db');
        parametersDB = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                logger.error('parameters-storage DB connection error: ' + err);
                reject(err);
            } else {
                // Create the parameter_types table if it doesn't exist
                const createTypesTableSQL = `
                    CREATE TABLE IF NOT EXISTS ${TABLE_TYPES} (
                        id TEXT PRIMARY KEY,
                        data TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `;

                // Create the parameter_sets table if it doesn't exist
                const createSetsTableSQL = `
                    CREATE TABLE IF NOT EXISTS ${TABLE_SETS} (
                        id TEXT PRIMARY KEY,
                        type_id TEXT NOT NULL,
                        data TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (type_id) REFERENCES ${TABLE_TYPES} (id) ON DELETE CASCADE
                    )
                `;

                parametersDB.serialize(() => {
                    parametersDB.run(createTypesTableSQL, (err) => {
                        if (err) {
                            logger.error('parameters-storage types table creation error: ' + err);
                            reject(err);
                            return;
                        }

                        parametersDB.run(createSetsTableSQL, (err) => {
                            if (err) {
                                logger.error('parameters-storage sets table creation error: ' + err);
                                reject(err);
                            } else {
                                resolve();
                            }
                        });
                    });
                });
            }
        });
    });
}

function getParameterTypes() {
    return new Promise((resolve, reject) => {
        _ensureTables().then(() => {
            if (currentStorage.storageType === 'odbc') {
                const device = runtime.devices.getDevice(currentStorage.odbcDeviceId, true);
                if (!device) {
                    reject(new Error('ODBC device not found'));
                    return;
                }
                device.executeSqliteQuery(`SELECT data FROM ${TABLE_TYPES}`).then(rows => {
                    try {
                        const types = rows.map(row => JSON.parse(row.data));
                        resolve(types);
                    } catch (parseErr) {
                        logger.error('parameters-storage JSON parse error: ' + parseErr);
                        reject(parseErr);
                    }
                }).catch(err => {
                    logger.error('parameters-storage get types error: ' + err);
                    reject(err);
                });
            } else {
                const sql = `SELECT data FROM ${TABLE_TYPES}`;
                parametersDB.all(sql, [], (err, rows) => {
                    if (err) {
                        logger.error('parameters-storage get types error: ' + err);
                        reject(err);
                    } else {
                        try {
                            const types = rows.map(row => JSON.parse(row.data));
                            resolve(types);
                        } catch (parseErr) {
                            logger.error('parameters-storage JSON parse error: ' + parseErr);
                            reject(parseErr);
                        }
                    }
                });
            }
        }).catch(reject);
    });
}

function saveParameterType(typeData) {
    return new Promise((resolve, reject) => {
        _ensureTables().then(() => {
            if (currentStorage.storageType === 'odbc') {
                const device = runtime.devices.getDevice(currentStorage.odbcDeviceId, true);
                if (!device) {
                    reject(new Error('ODBC device not found'));
                    return;
                }
                const jsonData = JSON.stringify(typeData);
                const sql = `INSERT OR REPLACE INTO ${TABLE_TYPES} (id, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)`;
                device.executeSqliteQuery(sql, [typeData.id, jsonData]).then(result => {
                    resolve({ changes: result.changes || 1 });
                }).catch(err => {
                    logger.error('parameters-storage save type error: ' + err);
                    reject(err);
                });
            } else {
                const jsonData = JSON.stringify(typeData);
                const sql = `
                    INSERT OR REPLACE INTO ${TABLE_TYPES} (id, data, updated_at)
                    VALUES (?, ?, CURRENT_TIMESTAMP)
                `;

                parametersDB.run(sql, [typeData.id, jsonData], function(err) {
                    if (err) {
                        logger.error('parameters-storage save type error: ' + err);
                        reject(err);
                    } else {
                        resolve({ changes: this.changes });
                    }
                });
            }
        }).catch(reject);
    });
}

function deleteParameterType(typeId) {
    return new Promise((resolve, reject) => {
        _ensureTables().then(() => {
            if (currentStorage.storageType === 'odbc') {
                const device = runtime.devices.getDevice(currentStorage.odbcDeviceId, true);
                if (!device) {
                    reject(new Error('ODBC device not found'));
                    return;
                }
                const sql = `DELETE FROM ${TABLE_TYPES} WHERE id = ?`;
                device.executeSqliteQuery(sql, [typeId]).then(result => {
                    resolve({ changes: result.changes || 1 });
                }).catch(err => {
                    logger.error('parameters-storage delete type error: ' + err);
                    reject(err);
                });
            } else {
                const sql = `DELETE FROM ${TABLE_TYPES} WHERE id = ?`;
                parametersDB.run(sql, [typeId], function(err) {
                    if (err) {
                        logger.error('parameters-storage delete type error: ' + err);
                        reject(err);
                    } else {
                        resolve({ changes: this.changes });
                    }
                });
            }
        }).catch(reject);
    });
}

function getParameterSets(typeId) {
    return new Promise((resolve, reject) => {
        _ensureTables().then(() => {
            if (currentStorage.storageType === 'odbc') {
                const device = runtime.devices.getDevice(currentStorage.odbcDeviceId, true);
                if (!device) {
                    reject(new Error('ODBC device not found'));
                    return;
                }
                const sql = `SELECT data FROM ${TABLE_SETS} WHERE type_id = ?`;
                device.executeSqliteQuery(sql, [typeId]).then(rows => {
                    try {
                        const sets = rows.map(row => JSON.parse(row.data));
                        resolve(sets);
                    } catch (parseErr) {
                        logger.error('parameters-storage JSON parse error: ' + parseErr);
                        reject(parseErr);
                    }
                }).catch(err => {
                    logger.error('parameters-storage get sets error: ' + err);
                    reject(err);
                });
            } else {
                const sql = `SELECT data FROM ${TABLE_SETS} WHERE type_id = ?`;
                parametersDB.all(sql, [typeId], (err, rows) => {
                    if (err) {
                        logger.error('parameters-storage get sets error: ' + err);
                        reject(err);
                    } else {
                        try {
                            const sets = rows.map(row => JSON.parse(row.data));
                            resolve(sets);
                        } catch (parseErr) {
                            logger.error('parameters-storage JSON parse error: ' + parseErr);
                            reject(parseErr);
                        }
                    }
                });
            }
        }).catch(reject);
    });
}

function getParameterSet(setId) {
    return new Promise((resolve, reject) => {
        _ensureTables().then(() => {
            if (currentStorage.storageType === 'odbc') {
                const device = runtime.devices.getDevice(currentStorage.odbcDeviceId, true);
                if (!device) {
                    reject(new Error('ODBC device not found'));
                    return;
                }
                const sql = `SELECT data FROM ${TABLE_SETS} WHERE id = ?`;
                device.executeSqliteQuery(sql, [setId]).then(rows => {
                    try {
                        const set = rows.length > 0 ? JSON.parse(rows[0].data) : null;
                        resolve(set);
                    } catch (parseErr) {
                        logger.error('parameters-storage JSON parse error: ' + parseErr);
                        reject(parseErr);
                    }
                }).catch(err => {
                    logger.error('parameters-storage get set error: ' + err);
                    reject(err);
                });
            } else {
                const sql = `SELECT data FROM ${TABLE_SETS} WHERE id = ?`;
                parametersDB.get(sql, [setId], (err, row) => {
                    if (err) {
                        logger.error('parameters-storage get set error: ' + err);
                        reject(err);
                    } else {
                        try {
                            const set = row ? JSON.parse(row.data) : null;
                            resolve(set);
                        } catch (parseErr) {
                            logger.error('parameters-storage JSON parse error: ' + parseErr);
                            reject(parseErr);
                        }
                    }
                });
            }
        }).catch(reject);
    });
}

function saveParameterSet(setData) {
    return new Promise((resolve, reject) => {
        _ensureTables().then(() => {
            if (currentStorage.storageType === 'odbc') {
                const device = runtime.devices.getDevice(currentStorage.odbcDeviceId, true);
                if (!device) {
                    reject(new Error('ODBC device not found'));
                    return;
                }
                const jsonData = JSON.stringify(setData);
                const sql = `INSERT OR REPLACE INTO ${TABLE_SETS} (id, type_id, data, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`;
                device.executeSqliteQuery(sql, [setData.id, setData.typeId, jsonData]).then(result => {
                    resolve({ changes: result.changes || 1 });
                }).catch(err => {
                    logger.error('parameters-storage save set error: ' + err);
                    reject(err);
                });
            } else {
                const jsonData = JSON.stringify(setData);
                const sql = `
                    INSERT OR REPLACE INTO ${TABLE_SETS} (id, type_id, data, updated_at)
                    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                `;

                parametersDB.run(sql, [setData.id, setData.typeId, jsonData], function(err) {
                    if (err) {
                        logger.error('parameters-storage save set error: ' + err);
                        reject(err);
                    } else {
                        resolve({ changes: this.changes });
                    }
                });
            }
        }).catch(reject);
    });
}

function deleteParameterSet(setId) {
    return new Promise((resolve, reject) => {
        _ensureTables().then(() => {
            if (currentStorage.storageType === 'odbc') {
                const device = runtime.devices.getDevice(currentStorage.odbcDeviceId, true);
                if (!device) {
                    reject(new Error('ODBC device not found'));
                    return;
                }
                const sql = `DELETE FROM ${TABLE_SETS} WHERE id = ?`;
                device.executeSqliteQuery(sql, [setId]).then(result => {
                    resolve({ changes: result.changes || 1 });
                }).catch(err => {
                    logger.error('parameters-storage delete set error: ' + err);
                    reject(err);
                });
            } else {
                const sql = `DELETE FROM ${TABLE_SETS} WHERE id = ?`;
                parametersDB.run(sql, [setId], function(err) {
                    if (err) {
                        logger.error('parameters-storage delete set error: ' + err);
                        reject(err);
                    } else {
                        resolve({ changes: this.changes });
                    }
                });
            }
        }).catch(reject);
    });
}

function exportParameterType(typeId) {
    return new Promise((resolve, reject) => {
        _ensureTables().then(() => {
            if (currentStorage.storageType === 'odbc') {
                const device = runtime.devices.getDevice(currentStorage.odbcDeviceId, true);
                if (!device) {
                    reject(new Error('ODBC device not found'));
                    return;
                }
                // Get the type data
                const typeSQL = `SELECT data FROM ${TABLE_TYPES} WHERE id = ?`;
                device.executeSqliteQuery(typeSQL, [typeId]).then(typeRows => {
                    if (typeRows.length === 0) {
                        reject(new Error('Parameter type not found'));
                        return;
                    }
                    // Get all sets for this type
                    const setsSQL = `SELECT data FROM ${TABLE_SETS} WHERE type_id = ?`;
                    device.executeSqliteQuery(setsSQL, [typeId]).then(setRows => {
                        try {
                            const typeData = JSON.parse(typeRows[0].data);
                            const setsData = setRows.map(row => JSON.parse(row.data));

                            const exportData = {
                                type: typeData,
                                sets: setsData,
                                exportedAt: new Date().toISOString()
                            };

                            resolve(exportData);
                        } catch (parseErr) {
                            logger.error('parameters-storage export JSON parse error: ' + parseErr);
                            reject(parseErr);
                        }
                    }).catch(err => {
                        logger.error('parameters-storage export sets error: ' + err);
                        reject(err);
                    });
                }).catch(err => {
                    logger.error('parameters-storage export type error: ' + err);
                    reject(err);
                });
            } else {
                // Get the type data
                const typeSQL = `SELECT data FROM ${TABLE_TYPES} WHERE id = ?`;
                parametersDB.get(typeSQL, [typeId], (err, typeRow) => {
                    if (err) {
                        logger.error('parameters-storage export type error: ' + err);
                        reject(err);
                        return;
                    }

                    if (!typeRow) {
                        reject(new Error('Parameter type not found'));
                        return;
                    }

                    // Get all sets for this type
                    const setsSQL = `SELECT data FROM ${TABLE_SETS} WHERE type_id = ?`;
                    parametersDB.all(setsSQL, [typeId], (err, setRows) => {
                        if (err) {
                            logger.error('parameters-storage export sets error: ' + err);
                            reject(err);
                            return;
                        }

                        try {
                            const typeData = JSON.parse(typeRow.data);
                            const setsData = setRows.map(row => JSON.parse(row.data));

                            const exportData = {
                                type: typeData,
                                sets: setsData,
                                exportedAt: new Date().toISOString()
                            };

                            resolve(exportData);
                        } catch (parseErr) {
                            logger.error('parameters-storage export JSON parse error: ' + parseErr);
                            reject(parseErr);
                        }
                    });
                });
            }
        }).catch(reject);
    });
}

function importParameterType(importData) {
    return new Promise((resolve, reject) => {
        _ensureTables().then(() => {
            if (currentStorage.storageType === 'odbc') {
                const device = runtime.devices.getDevice(currentStorage.odbcDeviceId, true);
                if (!device) {
                    reject(new Error('ODBC device not found'));
                    return;
                }
                if (!importData.type || !importData.sets) {
                    reject(new Error('Invalid import data format'));
                    return;
                }
                // Save the type
                const typeJson = JSON.stringify(importData.type);
                const typeSQL = `INSERT OR REPLACE INTO ${TABLE_TYPES} (id, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)`;
                device.executeSqliteQuery(typeSQL, [importData.type.id, typeJson]).then(() => {
                    // Save all sets
                    const promises = importData.sets.map(set => {
                        const setJson = JSON.stringify(set);
                        const setSQL = `INSERT OR REPLACE INTO ${TABLE_SETS} (id, type_id, data, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`;
                        return device.executeSqliteQuery(setSQL, [set.id, set.typeId, setJson]);
                    });
                    Promise.all(promises).then(() => {
                        resolve({ changes: 1 + importData.sets.length });
                    }).catch(err => {
                        logger.error('parameters-storage import set error: ' + err);
                        reject(err);
                    });
                }).catch(err => {
                    logger.error('parameters-storage import type error: ' + err);
                    reject(err);
                });
            } else {
                if (!importData.type || !importData.sets) {
                    reject(new Error('Invalid import data format'));
                    return;
                }

                parametersDB.serialize(() => {
                    // Save the type
                    const typeJson = JSON.stringify(importData.type);
                    const typeSQL = `
                        INSERT OR REPLACE INTO ${TABLE_TYPES} (id, data, updated_at)
                        VALUES (?, ?, CURRENT_TIMESTAMP)
                    `;

                    parametersDB.run(typeSQL, [importData.type.id, typeJson], function(err) {
                        if (err) {
                            logger.error('parameters-storage import type error: ' + err);
                            reject(err);
                            return;
                        }

                        // Save all sets
                        let completed = 0;
                        const totalSets = importData.sets.length;

                        if (totalSets === 0) {
                            resolve({ changes: 1 });
                            return;
                        }

                        importData.sets.forEach(set => {
                            const setJson = JSON.stringify(set);
                            const setSQL = `
                                INSERT OR REPLACE INTO ${TABLE_SETS} (id, type_id, data, updated_at)
                                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                            `;

                            parametersDB.run(setSQL, [set.id, set.typeId, setJson], function(err) {
                                if (err) {
                                    logger.error('parameters-storage import set error: ' + err);
                                    reject(err);
                                    return;
                                }

                                completed++;
                                if (completed === totalSets) {
                                    resolve({ changes: 1 + totalSets });
                                }
                            });
                        });
                    });
                });
            }
        }).catch(reject);
    });
}

function close() {
    if (parametersDB) {
        parametersDB.close((err) => {
            if (err) {
                logger.error('parameters-storage close error: ' + err);
            }
        });
    }
}

module.exports = {
    init: init,
    setStorage: setStorage,
    getParameterTypes: getParameterTypes,
    saveParameterType: saveParameterType,
    deleteParameterType: deleteParameterType,
    getParameterSets: getParameterSets,
    getParameterSet: getParameterSet,
    saveParameterSet: saveParameterSet,
    deleteParameterSet: deleteParameterSet,
    exportParameterType: exportParameterType,
    importParameterType: importParameterType,
    close: close
};