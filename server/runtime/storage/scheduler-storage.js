/**
 * Module to manage scheduler configuration storage
 */

'use strict';

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

var settings;
var logger;
var runtime;
var schedulerDB;

var TABLE_SCHEDULERS = 'schedulers';

function init(_settings, _log, _runtime) {
    settings = _settings;
    logger = _log;
    runtime = _runtime;
    
    return new Promise((resolve, reject) => {
        try {
            _createDB().then(() => {
                resolve();
            }).catch(err => {
                logger.error('scheduler-storage init error: ' + err);
                reject(err);
            });
        } catch (err) {
            logger.error('scheduler-storage init error: ' + err);
            reject(err);
        }
    });
}

function _createDB() {
    return new Promise((resolve, reject) => {
        const dbPath = path.join(settings.workDir, 'scheduler.db');
        schedulerDB = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                logger.error('scheduler-storage DB connection error: ' + err);
                reject(err);
            } else {
                // Create the schedulers table if it doesn't exist
                const createTableSQL = `
                    CREATE TABLE IF NOT EXISTS ${TABLE_SCHEDULERS} (
                        id TEXT PRIMARY KEY,
                        data TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `;
                
                schedulerDB.run(createTableSQL, (err) => {
                    if (err) {
                        logger.error('scheduler-storage table creation error: ' + err);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            }
        });
    });
}

function getSchedulerData(schedulerId) {
    return new Promise((resolve, reject) => {
        if (!schedulerDB) {
            reject(new Error('Scheduler database not initialized'));
            return;
        }
        
        const sql = `SELECT data FROM ${TABLE_SCHEDULERS} WHERE id = ?`;
        schedulerDB.get(sql, [schedulerId], (err, row) => {
            if (err) {
                logger.error('scheduler-storage get error: ' + err);
                reject(err);
            } else if (row) {
                try {
                    const data = JSON.parse(row.data);
                    resolve(data);
                } catch (parseErr) {
                    logger.error('scheduler-storage JSON parse error: ' + parseErr);
                    reject(parseErr);
                }
            } else {
                resolve(null);
            }
        });
    });
}

function setSchedulerData(schedulerId, data) {
    return new Promise((resolve, reject) => {
        if (!schedulerDB) {
            reject(new Error('Scheduler database not initialized'));
            return;
        }
        
        const jsonData = JSON.stringify(data);
        const sql = `
            INSERT OR REPLACE INTO ${TABLE_SCHEDULERS} (id, data, updated_at) 
            VALUES (?, ?, CURRENT_TIMESTAMP)
        `;
        
        schedulerDB.run(sql, [schedulerId, jsonData], function(err) {
            if (err) {
                logger.error('scheduler-storage set error: ' + err);
                reject(err);
            } else {
                resolve({ changes: this.changes });
            }
        });
    });
}

function getAllSchedulers() {
    return new Promise((resolve, reject) => {
        if (!schedulerDB) {
            reject(new Error('Scheduler database not initialized'));
            return;
        }
        
        const sql = `SELECT id, data FROM ${TABLE_SCHEDULERS}`;
        schedulerDB.all(sql, [], (err, rows) => {
            if (err) {
                logger.error('scheduler-storage get all error: ' + err);
                reject(err);
            } else {
                try {
                    const schedulers = rows.map(row => ({
                        id: row.id,
                        data: JSON.parse(row.data)
                    }));
                    resolve(schedulers);
                } catch (parseErr) {
                    logger.error('scheduler-storage JSON parse error: ' + parseErr);
                    reject(parseErr);
                }
            }
        });
    });
}

function deleteSchedulerData(schedulerId) {
    return new Promise((resolve, reject) => {
        if (!schedulerDB) {
            reject(new Error('Scheduler database not initialized'));
            return;
        }
        
        const sql = `DELETE FROM ${TABLE_SCHEDULERS} WHERE id = ?`;
        schedulerDB.run(sql, [schedulerId], function(err) {
            if (err) {
                logger.error('scheduler-storage delete error: ' + err);
                reject(err);
            } else {
                resolve({ changes: this.changes });
            }
        });
    });
}

function close() {
    if (schedulerDB) {
        schedulerDB.close((err) => {
            if (err) {
                logger.error('scheduler-storage close error: ' + err);
            }
        });
    }
}

module.exports = {
    init: init,
    getSchedulerData: getSchedulerData,
    setSchedulerData: setSchedulerData,
    getAllSchedulers: getAllSchedulers,
    deleteSchedulerData: deleteSchedulerData,
    close: close
};