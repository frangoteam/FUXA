/**
 * Module to manage the DAQ node with sqlite (a DaqNode per Device)
 * There are 2 database: 
 *      1 to map all Tags/Nodes with map-id, Tag/Node-id, name and type.
 *      2 to save the Tags/Nodes values with timestamp, map-id and value.
 * The values have a Timestamp resolution of Seconds
 */

'use strict';

const fs = require('fs');
const path = require('path');
var sqlite3 = require('sqlite3').verbose();

const db_daqdata_prefix = 'daq-data_';
const db_daqmap_prefix = 'daq-map_';
const db_daqtoken = 3600000;    // 1 hour
const archive_folder = 'archive';

function DaqNode(_settings, _log, _id, _currentStorate) {

    var settings = _settings;               // Application settings
    var logger = _log;                      // Application logger
    var id = _id;                           // Device id
    const currentStorage = _currentStorate  // Database to set the last value (current)
    var initready = false;                  // Initilized flag 
    var mapworking = false;                 // Data mapping working flag
    var dataworking = false;                // Save data working flag
    var db_daqmap;                          // Database of mapped data 
    var db_daqdata;                         // Database of data
    var daqTagsMap = {};                    // Mapped db Tags/Nodes
    var daqNextToken = new Date().getTime();// Interval to split Database data

    daqNextToken += (settings.daqTokenizer) ? db_daqtoken * settings.daqTokenizer : db_daqtoken * 24;
    if (settings.daqTokenizer === 0) {
        daqNextToken = 0;
    } else {
        // check database pending 
        var pendsfile = path.join(settings.dbDir, db_daqdata_prefix + id + '_');
        var pendsfiles = fs.readdirSync(settings.dbDir);
        for (var i in pendsfiles) {
            var filePath = path.join(settings.dbDir, pendsfiles[i]);
            if (filePath.indexOf(pendsfile) === 0) {
                _checkToArchiveDBfile(filePath);
            }
        }
    }
    // define file database
    var suffix = (daqNextToken) ? _getDateTimeSuffix(new Date()) : '';
    var db_daqdata_file = path.join(settings.dbDir, db_daqdata_prefix + id + '_' + suffix + '.db');
    var db_daqmap_file = path.join(settings.dbDir, db_daqmap_prefix + id + '.db');

    var db_daqmap_exists = require('fs').existsSync(db_daqmap_file);
    var db_daqdata_exists = require('fs').existsSync(db_daqdata_file);
    if (!db_daqmap_exists && db_daqdata_exists) {
        // reset daq db
        _resetDB(db_daqdata_file);
    }

    // bind database daqdata
    _bindDaqData(db_daqdata_file).then(result => {
        logger.info(`daqstorage.connected-to-data '${db_daqdata_file}' database`, true);
        db_daqdata = result;
    }).catch(function (err) {
        if (err) {
            logger.error(`daqstorage.connected-to-data failed! '${id}' ${err}`);
        }
    });

    // bind database daqmap
    _bindDaqMap(db_daqmap_file).then(result => {
        logger.info(`daqstorage.connected-to-map '${db_daqmap_file}' database`, true);
        db_daqmap = result;
        _loadMap().then(result => {
            logger.info(`daqstorage.load-map successful! '${id}'`, true);
            initready = true;
        }).catch(function (err) {
            if (err) {
                logger.error(`daqstorage.load-map failed! '${id}' ${err}`);
            }
        });
    }).catch(function (err) {
        if (err) {
            logger.error(`daqstorage.bind-map failed! '${id}' ${err}`);
        }
    });

    /**
     * Close data and map database
     */
    this.close = function () {
        if (db_daqmap) {
            db_daqmap.close();
        }
        if (db_daqdata) {
            db_daqdata.close();
        }
        logger.info(`daqstorage.closed successful! '${id}'`, true);
    }

    /**
     * Set function callback to get Tag/Node property and return function reference to set value
     */
    this.setCall = function (fncgetprop) {
        fncGetTagProp = fncgetprop;
        return this.addDaqValues;
    }
    var fncGetTagProp = null;

    /**
     * Add Daq value of Tag/Node
     * Check if the Tag/Node is mapped otherwise first add the value to data db then check if the db is to split and to archive
     */
    this.addDaqValue = function (tagid, tagvalue) {
        if (initready) {
            if (!daqTagsMap[tagid]) {
                // tags is not mapped
                var prop = fncGetTagProp(tagid);
                if (prop && _checkMapWorking(true)) {
                    _insertTagToMap(prop.id, prop.name, prop.type).then(function (result) {
                        _getTagMap(prop.id, prop.name, prop.type).then(function (result) {
                            _addTagMap(result.mapid, prop.id, prop.name);
                        }).catch(function (err) {
                            logger.error(`daqstorage.add-daq-value _getTagMap failed! '${id}' ${err}`);
                        });
                        _checkMapWorking(false);
                    }).catch(function (err) {
                        _checkMapWorking(false);
                        logger.error(`daqstorage.add-daq-value _insertTagToMap failed! '${id}' ${err}`);
                    });
                }
            } else {
                if (_checkDataWorking(true)) {
                    // check if db_daqdata are bindet
                    if (db_daqdata) {
                        _insertTagValue(daqTagsMap[tagid].mapid, tagvalue).then(function (lastts) {
                            // check db tokenizer after inserted
                            if (daqNextToken && daqNextToken < lastts) {
                                // close data DB, open and bind the new db, rename and move the closed db 
                                db_daqdata.close(function () {
                                    var suffix = _getDateTimeSuffix(new Date());
                                    var oldfile = db_daqdata_file;
                                    db_daqdata_file = path.join(settings.dbDir, db_daqdata_prefix + id + '_' + suffix + '.db');
                                    db_daqdata = null;
                                    _bindDaqData(db_daqdata_file).then(result => {
                                        logger.info(`daqstorage.add-daq-value _bindDaqData '${id}' database`, true);
                                        daqNextToken += (settings.daqTimeToken) ? db_daqtoken * settings.daqTimeToken : db_daqtoken;
                                        db_daqdata = result;
                                        _archiveDBfile(oldfile, lastts);
                                        _checkDataWorking(false);
                                    }).catch(function (err) {
                                        _checkDataWorking(false);
                                        logger.error(`daqstorage.add-daq-value _bindDaqData failed! '${id}' ${err}`);
                                    });
                                });
                            } else {
                                _checkDataWorking(false);
                            }
                        }).catch(function (err) {
                            _checkDataWorking(false);
                        });
                    } else {
                        // some things was wrong by tokenize...try to bind the db_daqdata 
                        _bindDaqData(db_daqdata_file).then(result => {
                            logger.info(`daqstorage.add-daq-value _bindDaqData '${db_daqmap_file}' database`, true);
                            db_daqdata = result;
                            _checkDataWorking(false);
                        }).catch(function (err) {
                            _checkDataWorking(false);
                            logger.error(`daqstorage.add-daq-value _bindDaqData failed! '${id}' ${err}`);
                        });
                    }
                }
            }
        }
    }

    /**
     * Add Daq value of Tag/Node
     * Check if the Tag/Node is mapped otherwise first add the value to data db then check if the db is to split and to archive
     */
    this.addDaqValues = function (tags, deviceName, deviceId) {
        if (initready) {
            if (db_daqdata) {
                var addMapfnc = [];
                var addDaqfnc = [];
                var dataToRestore = [];
                // prepare functions
                for (var tagid in tags) {
                    const tag = tags[tagid];
                    if (!tag.daq) {
                        continue;
                    }
                    if (tag.daq.restored) {
                        dataToRestore.push({id: tag.id, deviceId: deviceId, value: tag.value});
                    }
                    if (!tag.daq.enabled) {
                        continue;
                    }

                    if (!daqTagsMap[tagid]) {
                        var prop = fncGetTagProp(tagid);
                        if (prop) {
                            addMapfnc.push(_insertTagToMap(prop.id, prop.name, prop.type));
                        }
                    } else {
                        addDaqfnc.push(_insertTagValue(daqTagsMap[tagid].mapid, tag.value));
                    }
                }
                // check function to insert in map            
                if (addMapfnc.length > 0) {
                    Promise.all(addMapfnc).then(result => {
                        logger.info(`daqstorage.add-daq-values _insertTagToMap '${id}' ${result}`, true);
                        for (var idx = 0; idx < result.length; idx++) {
                            _getTagMap(result[idx]).then(function (result) {
                                _addTagMap(result.mapid, result.id, result.name);
                            }).catch(function (err) {
                                logger.error(`daqstorage.add-daq-value _getTagMap failed! '${id}' ${err}`);
                            });
                        }
                    }, reason => {
                        if (reason && reason.stack) {
                            logger.error(`daqstorage.add-daq-value _insertTagToMap failed! '${id}' ${reason.stack}`);
                        } else {
                            logger.error(`daqstorage.add-daq-value _insertTagToMap failed! '${id}' ${reason}`);
                        }
                        _checkDataWorking(false);
                    });
                } 
                // check function to add daq data            
                if (addDaqfnc.length > 0) {
                    if (_checkDataWorking(true)) {
                        Promise.all(addDaqfnc).then(result => {
                            // check db tokenizer after inserted
                            var lastts = 0 || result[0];
                            if (daqNextToken && daqNextToken < lastts) {
                                // close data DB, open and bind the new db, rename and move the closed db 
                                db_daqdata.close(function () {
                                    var suffix = _getDateTimeSuffix(new Date());
                                    var oldfile = db_daqdata_file;
                                    db_daqdata_file = path.join(settings.dbDir, db_daqdata_prefix + id + '_' + suffix + '.db');
                                    db_daqdata = null;
                                    _bindDaqData(db_daqdata_file).then(result => {
                                        logger.info(`daqstorage.add-daq-values '${db_daqmap_file}' database`, true);
                                        daqNextToken += (settings.daqTimeToken) ? db_daqtoken * settings.daqTimeToken : db_daqtoken;
                                        db_daqdata = result;
                                        _archiveDBfile(oldfile, lastts);
                                        _checkDataWorking(false);
                                    }).catch(function (err) {
                                        _checkDataWorking(false);
                                        logger.error(`daqstorage.add-daq-values _bindDaqData failed! '${id}' ${err}`);
                                    });
                                });
                            } else {
                                _checkDataWorking(false);
                            }
                        }, reason => {
                            if (reason && reason.stack) {
                                logger.error(`daqstorage.add-daq-values addDaqfnc failed! '${id}' ${reason.stack}`);
                            } else {
                                logger.error(`daqstorage.add-daq-values addDaqfnc failed! '${id}' ${reason}`);
                            }
                            _checkDataWorking(false);
                        });
                    }
                }
                if (dataToRestore.length && currentStorage) {
                    currentStorage.setValues(dataToRestore);
                }
            } else {
                // some things was wrong by tokenize...try to bind the db_daqdata 
                _bindDaqData(db_daqdata_file).then(result => {
                    logger.info(`daqstorage.add-daq-values '${db_daqmap_file}' database`, true);
                    db_daqdata = result;
                    _checkDataWorking(false);
                }).catch(function (err) {
                    _checkDataWorking(false);
                    logger.error(`daqstorage.add-daq-values _bindDaqData failed! '${id}' ${err}`);
                });
            }
        }
    }

    /**
     * Return Tags/Nodes map list
     */
    this.getDaqMap = function () {
        return daqTagsMap;
    }

    /**
     * Return array of timeserie <timestamp, value>
     */
    this.getDaqValue = function (tagid, fromts, tots) {
        return new Promise(function (resolve, reject) {
            if (daqTagsMap[tagid]) {
                var result = [];
                // search in current db
                _getTagValues(db_daqdata, daqTagsMap[tagid].mapid, fromts, tots).then(function (rows) {
                    // search in archive
                    var archivefiles = _getArchiveFiles(id, fromts, tots);
                    var dbfncs = [];
                    archivefiles.forEach(file => {
                        dbfncs.push(_bindAndGetTagValues(file, daqTagsMap[tagid].mapid, fromts, tots));
                    });
                    Promise.all(dbfncs).then(values => {
                        for (var i = 0; i < values.length; i++) {
                            result = result.concat(values[i]);
                        }
                        result = result.concat(rows);
                        resolve(result);
                    }, reason => {
                        if (reason.stack) {
                            logger.error(`daqstorage.get-daq-value failed! '${id}' ${reason.stack}`);
                        } else {
                            logger.error(`daqstorage.get-daq-value failed! '${id}' ${reason}`);
                        }
                        reject(reason);
                    });
                }).catch(function (err) {
                    logger.error(`daqstorage.get-daq-value _getTagValues failed! '${id}' ${err}`);
                    reject(err);
                });
            } else {
                reject('tag id ' + tagid + ' not found!');
            }
        });
    }

    /**
     * Used to manage the async add Tag/Node in map db (that not overloading)
     * @param {*} check 
     */
    var _checkMapWorking = function (check) {
        if (check && mapworking) {
            logger.warn(`daqstorage.mapping-overload! '${id}'`);
            return false;
        }
        mapworking = check;
        return true;
    }

    /**
     * Used to manage the async add Tag/Node in data db (that not overloading)
     * @param {*} check 
     */
    var _checkDataWorking = function (check) {
        if (check && dataworking) {
            logger.warn(`daqstorage.data-overload! '${id}'`);
            return false;
        }
        dataworking = check;
        return true;
    }

    /**
     * Bind the map database by create the table if not exist
     * @param {*} dbfile 
     */
    function _bindDaqMap(dbfile) {
        return new Promise(function (resolve, reject) {
            try {
                var db = new sqlite3.Database(dbfile, function (err) {
                    if (err) {
                        logger.error(`daqstorage.bind-daq-map error! '${id}' ${err}`);
                        reject();
                    }
                    logger.info(`daqstorage.bind-daq-map '${dbfile}' database`, true);
                });
                db.serialize(function () {
                    db.run("CREATE TABLE if not exists data (mapid INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT, name TEXT, type TEXT)", function (err) {
                        if (err) {
                            logger.error(`daqstorage.bind-daq-map-to-create-table error! '${id}' ${err}`);
                            reject();
                        } else {
                            resolve(db);
                        }
                    });
                });
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Bind the data database by create the table if not exist
     * @param {*} dbfile 
     */
    function _bindDaqData(dbfile) {
        return new Promise(function (resolve, reject) {
            try {
                var db = new sqlite3.Database(dbfile, function (err) {
                    if (err) {
                        logger.error(`daqstorage.bind-daq-data error! '${id}' ${err}`);
                        reject();
                    }
                    logger.info(`daqstorage.bind-daq-data '${dbfile}' database`, true);
                });
                db.serialize(function () {
                    db.run("CREATE TABLE if not exists data (dt INTEGER, id INTEGER, value TEXT)", function (err) {
                        if (err) {
                            logger.error(`daqstorage.bind-daq-data-to-create-table error! '${id}' ${err}`);
                            reject();
                        } else {
                            resolve(db);
                        }
                    });
                });
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Move the db file to archive folder.
     * Open the db take the last data and rename the file with the start and last data time
     * @param {*} dbfile 
     */
    function _checkToArchiveDBfile(dbfile) {
        if (dbfile.indexOf('-journal') !== -1) {
            // delete pending db journal
            try {
                fs.unlinkSync(dbfile);
                logger.info(`daqstorage.check-to-archive-db-file '${dbfile}' pending db journal deleted!`, true);
            } catch (e) { 
                console.error(e);
            }
        } else {
            _bindDaqData(dbfile).then(result => {
                logger.info(`daqstorage.check-to-archive-db-file '${dbfile}'`, true);
                _getLastTagValue(result).then(lastrow => {
                    result.close(function () {
                        // rename and move to archive
                        if (lastrow) {
                            var filearchived = _archiveDBfile(dbfile, lastrow.dt);
                            logger.info(`daqstorage.check-to-archive-db-file '${filearchived}'`, true);
                        } else {
                            // delete void db
                            try {
                                fs.unlinkSync(dbfile);
                                logger.info(`daqstorage.check-to-archive-db-file '${dbfile}' database deleted!`, true);
                            } catch (e) { 
                                console.error(e);
                            }
                        }
                    });
                }).catch(function (err) {
                    logger.error(`daqstorage.check-to-archive-db-file error! '${id}' ${err}`);
                });
            }).catch(function (err) {
                logger.error(`daqstorage.check-to-archive-db-file error! '${id}' ${err}`);
            });
        }
    }

    function _getArchiveFiles(id, fromts, tots) {
        const archive = path.resolve(settings.dbDir, archive_folder);
        var result = [];
        if (fs.existsSync(archive)) {
            fs.readdirSync(archive).forEach(file => {
                const fromTo = _suffixToTimestamp(file);
                if (file.indexOf(`_${id}_`) > 0 && fromTo && fromTo.from <= tots && fromTo.to >= fromts) {
                    result.push(path.join(archive, file));
                }
            });
            result.sort();
        }
        return result;
    }

    function _archiveDBfile(dbfile, ts) {
        var suffix = _getDateTimeSuffix(new Date(ts));
        var archive = path.resolve(settings.dbDir, archive_folder);
        if (!fs.existsSync(archive)) {
            fs.mkdirSync(archive);
        }
        var dbfilenew = path.join(archive, path.basename(dbfile, path.extname(dbfile))) + '_' + suffix + path.extname(dbfile);
        try {
            fs.renameSync(dbfile, dbfilenew);
        } catch (err) {
            console.error(err);
        }
        return dbfilenew;
    }

    function _getDateTimeSuffix(dt) {
        var yyyy = dt.getFullYear();
        var mm = dt.getMonth() + 1;
        var dd = dt.getDate();
        if (dd < 10) {
            dd = '0' + dd;
        }
        if (mm < 10) {
            mm = '0' + mm;
        }
        var HH = dt.getHours();
        var MM = dt.getMinutes();
        var SS = dt.getSeconds();
        if (HH < 10) {
            HH = '0' + HH;
        }
        if (MM < 10) {
            MM = '0' + MM;
        }
        if (SS < 10) {
            SS = '0' + SS;
        }
        return '' + yyyy + mm + dd + HH + MM + SS;
    }

    function _resetDB(file) {
        try {
            fs.unlinkSync(file);
            logger.info(`daqstorage._resetDB '${file}' file of database deleted!`, true);
        } catch (err) {
            console.error(err);
        }
    }

    function _loadMap() {
        daqTagsMap = {};
        return new Promise(function (resolve, reject) {
            db_daqmap.all("SELECT mapid, id, name, type FROM data", function (err, rows) {
                if (err) {
                    reject(err);
                }
                else if (rows) {
                    for (var idx = 0; idx < rows.length; idx++) {
                        var row = rows[idx];
                        _addTagMap(row.mapid, row.id, row.name);
                        // cfg.push({ id: row.mapid, name: row.name, interval_range: row.interval_range, interval: row.interval, sample_range: row.sample_range, samples: row.samples, enabled: row.enabled, divisor: row.divisor, value: null });

                    }
                }
                resolve(true);
            });
        });
    }

    function _getTagMap(id) {
        return new Promise(function (resolve, reject) {
            var sql = "SELECT mapid, id, name, type FROM data WHERE id = ?";
            db_daqmap.get(sql, [id], function (err, row) {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    function _insertTagToMap(tagid, name, type) {
        return new Promise(function (resolve, reject) {
            var sqlRequest = "INSERT INTO data (id, name, type) ";
            db_daqmap.run(sqlRequest + "VALUES('" + tagid + "','" + name + "','" + type + "'); SELECT last_insert_rowid() FROM data", function (err) {
                if (err !== null) {
                    reject(err);
                } else {
                    resolve(tagid);
                }
            });
        });
    }

    function _getLastTagValue(db) {
        return new Promise(function (resolve, reject) {
            var sql = "SELECT dt FROM data ORDER BY dt DESC LIMIT 1";
            db.get(sql, [], function (err, row) {
                if (err) {
                    console.error(err);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    function _bindAndGetTagValues(dbfile, id, fromts, tots) {
        return new Promise(function (resolve, reject) {
            _bindDaqData(dbfile).then(result => {
                _getTagValues(result, id, fromts, tots).then(rows => {
                    result.close();
                    resolve(rows);
                }).catch(function (err) {
                    reject(err);
                });
            }).catch(function (err) {
                reject(err);
            });
        });
    }

    function _getTagValues(db, id, fromts, tots) {
        return new Promise(function (resolve, reject) {
            const booleanMapping = { "true": true, "false": false };
            var sql = "SELECT dt, value FROM data WHERE id = ? AND dt BETWEEN ? and ? ORDER BY dt ASC";
            db.all(sql, [id, fromts, tots], function (err, rows) {
                if (err) {
                    console.error(err);
                    reject(err);
                } else {
                    for (var i = 0; i < rows.length; i++) {
                        rows[i].value =  booleanMapping[rows[i].value] !== undefined ? booleanMapping[rows[i].value] : rows[i].value;
                    }
                    resolve(rows);
                }
            });
        });
    }

    function _insertTagValue(mapid, value) {
        return new Promise(function (resolve, reject) {
            var ts = new Date().getTime();
            var sqlRequest = "INSERT INTO data (dt, id, value) ";
            db_daqdata.run(sqlRequest + "VALUES('" + ts + "','" + mapid + "','" + value + "')", function (err) {
                if (err !== null) {
                    reject();
                }
                else {
                    resolve(ts);
                }
            });
        });
    }

    function _addTagMap(mapid, id, name) {
        if (daqTagsMap[id]) {
            return false;
        }
        daqTagsMap[id] = { mapid: mapid, name: name };
        return true;
    }

    return true;
}

/**
 * Check and remove old data
 */
function checkRetention(dtlimit, dbDir, callbackRemoved, callbackError) {
    var archiveDir = path.resolve(dbDir, archive_folder);
    if (fs.existsSync(archiveDir)) {
        var files = fs.readdirSync(archiveDir);
        files.forEach(file => {
            const fromTo = _suffixToTimestamp(file);
            if (fromTo && fromTo.from < dtlimit.getTime()) {
                try {
                    fs.unlink(path.join(archiveDir, file), (err) => {
                        if (err && callbackError) {
                            callbackError(`daqstorage.checkRetention remove file ${file} failed! ${err}`);
                        }
                    });
                    if (callbackRemoved) {
                        callbackRemoved(file);
                    }
                } catch (error) {
                    console.error(error);
                 }
            }
        });
    }
}

function _suffixToTimestamp(file) {
    function _parseSuffix(dtText) {
        if (dtText.length >= 14) {
            var yyyy = parseInt(dtText.substring(0, 4));
            var mm = parseInt(dtText.substring(4, 6)) - 1;
            var dd = parseInt(dtText.substring(6, 8));
            var HH = parseInt(dtText.substring(8, 10));
            var MM = parseInt(dtText.substring(10, 12));
            var SS = parseInt(dtText.substring(12, 14));
            return new Date(yyyy, mm, dd, HH, MM, SS).getTime();
        }
        return null;
    }
    var ranges = file.split('_');
    if (ranges.length >= 3) {
        return { from: _parseSuffix(ranges[ranges.length - 2]),
                to: _parseSuffix(ranges[ranges.length - 1])
        };
    }
    return null;
}

module.exports = {
    create: function (data, logger, id, currentStorate) {
        return new DaqNode(data, logger, id, currentStorate);
    },
    checkRetention: checkRetention
};