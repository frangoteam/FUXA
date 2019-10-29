/**
 *  Module to manage the DAQ node with sqlite
 *  The values have a Timestamp resolution of Seconds
 */

'use strict';

const fs = require('fs');
const path = require('path');
var sqlite3 = require('sqlite3').verbose();

const db_daqdata_prefix = 'daq-data_';
const db_daqmap_prefix = 'daq-map_';
const db_daqtoken = 3600000;    // 1 hour

function DaqNode(_settings, _log, _id) {

    var settings = _settings;
    var logger = _log;
    var id = _id;

    var initready = false;
    var mapworking = false;
    var dataworking = false;
    var db_daqmap;
    var db_daqdata;
    var daqTagsMap = {};              // Mapped db signale
    var daqNextToken = new Date().getTime();// + (settings.daqTimeToken) ? db_daqtoken * settings.daqTimeToken : db_daqtoken;
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
        logger.info('daqstorage: Connected to data ' + db_daqmap_file + ' database.');
        db_daqdata = result;
    }).catch(function (err) {
        if (err) {
            logger.err(err);
        }
    });

    // bind database daqmap
    _bindDaqMap(db_daqmap_file).then(result => {
        logger.info('daqstorage: Connected to map ' + db_daqmap_file + ' database.');
        db_daqmap = result;
        _loadMap().then(result => {
            logger.info("daqstorage init successful!");
            initready = true;
        }).catch(function (err) {
            if (err) {
                logger.err(err);
            }
        });
    }).catch(function (err) {
        if (err) {
            logger.err(err);
        }
    });

    this.close = function () {
        if (db_daqmap) {
            db_daqmap.close();
        }
        if (db_daqdata) {
            db_daqdata.close();
        }
        logger.info("daqnode closed!");
    }

    var fncGetTagProp = null;

    this.setCall = function (fncgetprop) {
        fncGetTagProp = fncgetprop;
        return this.addDaqValues;
    }

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
                            logger.err('addDaqValue _getTagMap error: ' + err);
                        });
                        _checkMapWorking(false);
                    }).catch(function (err) {
                        _checkMapWorking(false);
                        logger.err('addDaqValue _insertTagToMap error: ' + err);
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
                                        logger.info('daqstorage: Connected to data ' + db_daqmap_file + ' database.');
                                        daqNextToken += (settings.daqTimeToken) ? db_daqtoken * settings.daqTimeToken : db_daqtoken;
                                        db_daqdata = result;
                                        _archiveDBfile(oldfile, lastts);
                                        _checkDataWorking(false);
                                    }).catch(function (err) {
                                        _checkDataWorking(false);
                                        logger.err('addDaqValue _bindDaqData error: ' + err);
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
                            logger.info('daqstorage: Connected to data ' + db_daqmap_file + ' database.');
                            db_daqdata = result;
                            _checkDataWorking(false);
                        }).catch(function (err) {
                            _checkDataWorking(false);
                            logger.err('addDaqValue _bindDaqData error: ' + err);
                        });
                    }
                }
            }
            console.log('add> ' + id);
        }
    }

    this.addDaqValues = function (tags, tagid, tagvalue) {
        if (initready) {
            if (db_daqdata) {
                var addMapfnc = [];
                var addDaqfnc = [];
                // prepare functions
                for (var tagid in tags) {
                    if (!daqTagsMap[tagid]) {
                        var prop = fncGetTagProp(tagid);
                        addMapfnc.push(_insertTagToMap(prop.id, prop.name, prop.type));
                    } else {
                        addDaqfnc.push(_insertTagValue(daqTagsMap[tagid].mapid, tags[tagid].value));
                    }
                }
                // check function to insert in map            
                if (addMapfnc.length > 0) {
                    Promise.all(addMapfnc).then(result => {
                        logger.info('addDaqValues _insertTagToMap successfull: ' + result);
                        for (var idx = 0; idx < result.length; idx++) {
                            _getTagMap(result[idx]).then(function (result) {
                                _addTagMap(result.mapid, result.id, result.name);
                            }).catch(function (err) {
                                logger.err('addDaqValues _getTagMap error: ' + err);
                            });
                        }
                    }, reason => {
                        if (reason.stack) {
                            logger.error(data.name + ' _insertTagToMap error: ' + reason.stack);
                        } else {
                            logger.error(data.name + ' _insertTagToMap error: ' + reason);
                        }
                        _checkWorking(false);
                    });
                } 
                // check function to add daq data            
                if (addDaqfnc.length > 0) {
                    if (_checkDataWorking(true)) {
                        Promise.all(addDaqfnc).then(result => {
                            // logger.info('addDaqValues _insertTagValue successfull: ' + result);
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
                                        logger.info('daqstorage: Connected to data ' + db_daqmap_file + ' database.');
                                        daqNextToken += (settings.daqTimeToken) ? db_daqtoken * settings.daqTimeToken : db_daqtoken;
                                        db_daqdata = result;
                                        _archiveDBfile(oldfile, lastts);
                                        _checkDataWorking(false);
                                    }).catch(function (err) {
                                        _checkDataWorking(false);
                                        logger.err('addDaqValues _bindDaqData error: ' + err);
                                    });
                                });
                            } else {
                                _checkDataWorking(false);
                            }                            
                        }, reason => {
                            if (reason.stack) {
                                logger.error(data.name + ' _insertTagValue error: ' + reason.stack);
                            } else {
                                logger.error(data.name + ' _insertTagValue error: ' + reason);
                            }
                            _checkWorking(false);
                        });
                    }
                }
                // console.log('add> ' + id);
            } else {
                // some things was wrong by tokenize...try to bind the db_daqdata 
                _bindDaqData(db_daqdata_file).then(result => {
                    logger.info('daqstorage: Connected to data ' + db_daqmap_file + ' database.');
                    db_daqdata = result;
                    _checkDataWorking(false);
                }).catch(function (err) {
                    _checkDataWorking(false);
                    logger.err('addDaqValue _bindDaqData error: ' + err);
                });
            }
        }
    }

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
                    var archivefiles = _getArchiveFiles(fromts, tots);
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
                            logger.error('getDaqValue error: ' + reason.stack);
                        } else {
                            logger.error('getDaqValue error: ' + reason);
                        }
                        reject(reason);
                    });
                }).catch(function (err) {
                    logger.error('getDaqValue _getTagValues error: ' + err);
                    reject(err);
                });
            } else {
                reject('tag id ' + tagid + ' not found!');
            }
        });
    }

    // logger.info("init daqstorage created successful!");

    var _checkMapWorking = function (check) {
        if (check && mapworking) {
            logger.error(id + ' insertMap overload!');
            return false;
        }
        mapworking = check;
        return true;
    }

    var _checkDataWorking = function (check) {
        if (check && dataworking) {
            logger.error(id + ' insertData overload!');
            return false;
        }
        dataworking = check;
        return true;
    }

    function _bindDaqMap(dbfile) {
        return new Promise(function (resolve, reject) {
            try {
                var db = new sqlite3.Database(dbfile, function (err) {
                    if (err) {
                        logger.err('daq-map db: failed to bind: ' + err);
                        reject();
                    }
                    logger.info('daqstorage: Connected to ' + dbfile + ' database.');
                });
                db.serialize(function () {
                    db.run("CREATE TABLE if not exists data (mapid INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT, name TEXT, type TEXT)", function (err) {
                        if (err) {
                            logger.err('daq-map db: failed to create table: ' + err);
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

    function _bindDaqData(dbfile) {
        return new Promise(function (resolve, reject) {
            try {
                var db = new sqlite3.Database(dbfile, function (err) {
                    if (err) {
                        logger.err('daq-data db: failed to bind: ' + err);
                        reject();
                    }
                    logger.info('daqstorage: Connected to ' + dbfile + ' database.');
                });
                db.serialize(function () {
                    db.run("CREATE TABLE if not exists data (dt INTEGER, id INTEGER, value TEXT)", function (err) {
                        if (err) {
                            logger.err('daq-data db: failed to create table: ' + err);
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

    function _checkToArchiveDBfile(dbfile) {
        _bindDaqData(dbfile).then(result => {
            logger.info('_checkToArchiveDBfile: try to archive ' + dbfile + ' database.');
            _getLastTagValue(result).then(lastrow => {
                result.close(function () {
                    // rename and move to archive
                    if (lastrow) {
                        var filearchived = _archiveDBfile(dbfile, lastrow.dt);
                        logger.info('_checkToArchiveDBfile: move to ' + filearchived);
                    } else {
                        // delete void db
                        try {
                            fs.unlinkSync(dbfile);
                            logger.info('_checkToArchiveDBfile :' + dbfile + ' database deleted!.');
                        } catch (e) { }
                    }
                });
            }).catch(function (err) {
                logger.err('checkToArchiveDBfile: error ' + err);
            });
        }).catch(function (err) {
            logger.err('_checkToArchiveDBfile: error ' + err);
        });
    }

    function _getArchiveFiles(fromts, tots) {
        var archive = path.resolve(settings.dbDir, 'archive');
        var result = [];
        if (fs.existsSync(archive)) {
            fs.readdirSync(archive).forEach(file => {
                var ranges = file.split('_');
                if (ranges.length >= 3) {
                    var fr = ranges[ranges.length - 2];
                    var to = ranges[ranges.length - 1];
                    var f = _suffixToTimestamp(fr);
                    var t = _suffixToTimestamp(to);
                    if (f <= tots && t >= fromts) {
                        result.push(path.join(archive, file));
                    }
                }
                console.log(file);
            });
            result.sort();
        }
        // result.reverse();
        return result;
    }

    function _archiveDBfile(dbfile, ts) {
        var suffix = _getDateTimeSuffix(new Date(ts));
        var archive = path.resolve(settings.dbDir, 'archive');
        if (!fs.existsSync(archive)) {
            fs.mkdirSync(archive);
        }
        var dbfilenew = path.join(archive, path.basename(dbfile, path.extname(dbfile))) + '_' + suffix + path.extname(dbfile);
        fs.renameSync(dbfile, dbfilenew);
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

    function _suffixToTimestamp(dt) {
        if (dt.length >= 14) {
            var yyyy = parseInt(dt.substring(0, 4));
            var mm = parseInt(dt.substring(4, 6)) - 1;
            var dd = parseInt(dt.substring(6, 8));
            var HH = parseInt(dt.substring(8, 10));
            var MM = parseInt(dt.substring(10, 12));
            var SS = parseInt(dt.substring(12, 14));
            return new Date(yyyy, mm, dd, HH, MM, SS).getTime();
        }
        return null;
    }

    function _resetDB(file) {
        fs.unlinkSync(file);
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
                    console.log(err);
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
            var sql = "SELECT dt, value FROM data WHERE id = ? AND dt BETWEEN ? and ? ORDER BY dt ASC";
            db.all(sql, [id, fromts, tots], function (err, rows) {
                if (err) {
                    console.log(err);
                    reject(err);
                } else {
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

module.exports = {
    create: function (data, logger, events) {
        return new DaqNode(data, logger, events);
    }
};