/**
 * 's7': snap7 wrapper to communicate with Siemens PLC (S7) 
 */

var snap7 = require('node-snap7');
const datatypes = require('./datatypes');


function S7client(_data, _logger, _events) {

    var db = {};                        // Loaded Signal in DB format { DB index, start, size, ... }
    var data = _data;                   // Current Device data { id, name, tags, enabled, ... }
    var logger = _logger;               // Logger
    var s7client = new snap7.S7Client();// Client node-S7
    var working = false;                // Working flag to manage overloading polling and connection
    var events = _events;               // Events to commit change to runtime
    var lastStatus = '';                // Last Device status
    var varsValue = [];                 // Signale to send to frontend { id, type, value }
    var varsItemsMap = {};              // Mapped Signale name with DbItem to find for set value

    this.connect = function () {
        return new Promise(function (resolve, reject) {
            if (data.property && data.property.rack >= 0 && data.property.slot >= 0) {
                try {
                    if (!s7client.Connected()) {
                        _checkWorking(false);
                        s7client.ConnectTo(data.property.address, data.property.rack, data.property.slot, function (err) {
                            if (err) {
                                logger.error(data.name + ': try to connect failed! ' + err);
                                _emitStatus('connect-error');
                                _clearVarsValue();
                                reject();
                            } else {
                                logger.info(data.name + ': connected!');
                                _emitStatus('connect-ok');
                                resolve();
                            }
                            // var pdusize = s7client.GetParam(s7client['PDURequest']);
                        });
                    }
                } catch (err) {
                    logger.error(data.name + ': try to connect error! ' + err);
                    _emitStatus('connect-error');
                    _clearVarsValue();
                    reject();
                }
            } else {
                logger.error(data.name + ': missing connection data!');
                _emitStatus('connect-failed');
                _clearVarsValue();
                reject();
            }
        });
    }

    this.disconnect = function () {
        return new Promise(function (resolve, reject) {
            _checkWorking(false);
            if (!s7client.Connected()) {
                _emitStatus('connect-off');
                _clearVarsValue();
                resolve(true);
            } else {
                var result = s7client.Disconnect();
                if (result) {
                    logger.info(data.name + ' disconnected!');
                } else {
                    logger.error(data.name + ' try to disconnect failed!');
                }
                _emitStatus('connect-off');
                _clearVarsValue();
                resolve(result);
            }
        });
    }

    this.polling = function () {
        // console.log(data.name + ': polling');
        if (_checkWorking(true)) {
            var readDBfnc = [];
            for (var dbnum in db) {
                readDBfnc.push(_readDB(parseInt(dbnum), Object.values(db[dbnum].Items)));
            }
            Promise.all(readDBfnc).then(result => {
                _checkWorking(false);
                if (result.length) {
                    let varsValueChanged = _updateVarsValue(result);
                    if (varsValueChanged) {
                        _emitValues(varsValueChanged);
                    }
                }
            }, reason => {
                if (reason.stack) {
                    logger.error(data.name + ' _readDB error: ' + reason.stack);
                } else {
                    logger.error(data.name + ' _readDB error: ' + reason);
                }
                _checkWorking(false);
            });
            // _readDB(parseInt(dbnum), Object.values(db[dbnum].Items)).then(function (result) {
            //     _checkWorking(false);
            //     if (result.length) {
            //         _emitValues(result);
            //     }
            //     varsValue = result;
            // }).catch(function (err) {
            //     if (err.stack) {
            //         logger.error(data.name + ' _readDB error: ' + err.stack);
            //     } else {
            //         logger.error(data.name + ' _readDB error: ' + err);
            //     }
            //     // devices.woking = null;
            //     _checkWorking(false);
            // });                    
        }
    }

    this.load = function (_data) {
        data = _data;
        db = {};
        varsValue = [];
        varsItemsMap = {};
        var count = 0;
        for (var id in data.tags) {
            var varDb = _getDBValue(data.tags[id]);
            if (varDb) {
                if (!db[varDb.dbnum]) {
                    var grptag = new DbItems(varDb.dbnum);
                    db[varDb.dbnum] = grptag;
                }
                if (!db[varDb.dbnum].Items[varDb.start]) {
                    db[varDb.dbnum].Items[varDb.start] = varDb;
                }
                db[varDb.dbnum].Items[varDb.start].Tags.push(data.tags[id]);
                if (db[varDb.dbnum].MaxSize < varDb.start + datatypes[varDb.type].S7WordLen) {
                    db[varDb.dbnum].MaxSize = varDb.start + datatypes[varDb.type].S7WordLen;
                }
                // check Bit to Map
                if (varDb.bit >= 0) {
                    varDb.BitMap[varDb.bit] = id;
                }
                count++;
                varsItemsMap[id] = db[varDb.dbnum].Items[varDb.start];
            }
        }
        logger.info(data.name + ' data loaded (' + count + ')');
    }

    /**
     * Return values array { id: <name>, value: <value>, type: <type> }
     */
    this.getValues = function () {
        return varsValue;
    }

    this.getStatus = function () {
        return lastStatus;
    }

    this.setValue = function (sigid, value) {
        var varDb = _getDBValue(data.tags[sigid]);

        if (varDb) { //varsItemsMap[sigid]) {
            var dbitem = varsItemsMap[sigid];
            varDb.value = value;
            console.log(dbitem);
            _writeVars([varDb]).then(result => {
            // _writeDB(dbitem.dbnum, [dbitem]).then(result => {
                console.log(result);
            }, reason => {
                if (reason.stack) {
                    logger.error(data.name + ' _writeDB error: ' + reason.stack);
                } else {
                    logger.error(data.name + ' _writeDB error: ' + reason);
                }
            });
        }
    }

    this.isConnected = function () {
        return s7client.Connected();
    }

    _clearVarsValue = function () {
        for (let id in varsValue) {
            varsValue[id].value = null;
        }
        for (var dbid in db) {
            for (var itemid in db[dbid].Items) {
                db[dbid].Items[itemid].value = null;
            }
        }
        _emitValues(varsValue);
    }

    _updateVarsValue = function (dbvalues) {
        var someval = false;
        var result = [];
        for (var dbid in dbvalues) {
            let dbitems = dbvalues[dbid];
            for (var itemid in dbitems) {
                let dbitem = dbitems[itemid];
                let type = dbitems[itemid].type;
                let value = dbitems[itemid].value;
                let tags = dbitems[itemid].Tags;
                tags.forEach(tag => {
                    if (type === 'BOOL') {
                        try {
                            let pos = parseInt(tag.address.charAt(tag.address.length - 1));
                            result[tag.name] = { id: tag.name, value: (_getBit(value, pos)) ? 1 : 0, type: type };
                        } catch (err) { }
                    } else {
                        result[tag.name] = { id: tag.name, value: value, type: type };
                    }
                    someval = true;
                });
                console.log(value);
            }
        }
        if (someval) {
            for (var id in result) {
                varsValue[id] = result[id];
            }
            return result;
        }
        return null;
    }

    //#region Bit Manipolation
    _getBit = function (number, bitPosition) {
        // return (number & (1 << bitPosition)) === 0 ? 0 : 1;
        return ((number >> bitPosition) % 2 != 0)
    }

    _setBit = function (number, bitPosition) {
        // return number | (1 << bitPosition);
        return number | 1 << bitPosition;
    }

    _clearBit = function (number, bitPosition) {
        // const mask = ~(1 << bitPosition);
        // return number & mask;
        return number & ~(1 << bitPosition);
    }

    _toggleBit = function (number, bitPosition) {
        return _getBit(number, bitPosition) ? _clearBit(number, bitPosition) : _setBit(number, bitPosition);
    }
    //#endregion

    _emitValues = function (values) {
        events.emit('device-value:changed', { id: data.name, values: values });
    }

    _emitStatus = function (status) {
        lastStatus = status;
        events.emit('device-status:changed', { id: data.name, status: status });
    }

    _checkWorking = function (check) {
        if (check && working) {
            logger.error(data.name + ' working (polling) overload!');
            return false;
        }
        working = check;
        return true;
    }

    /**
     * Read a DB and parse the result
     * @param {int} DBNr - The DB Number to read
     * @param {array} vars - Array of Var objects
     * @param {int} vars[].start - Position of the first byte
     * @param {int} [vars[].bit] - Position of the bit in the byte
     * @param {Datatype} vars[].type - Data type (BYTE, WORD, INT, etc), see {@link /s7client/?api=Datatypes|Datatypes}
     * @returns {Promise} - Resolves to the vars array with populate *value* property
     */
    _readDB = function (DBNr, vars) {
        return new Promise((resolve, reject) => {
            if (vars.length === 0) return resolve([]);

            let end = 0;
            let offset = Number.MAX_SAFE_INTEGER;
            vars.forEach(v => {
                if (v.start < offset) offset = v.start;
                if (end < v.start + datatypes[v.type].bytes) {
                    end = v.start + datatypes[v.type].bytes;
                }
            });
            s7client.DBRead(DBNr, offset, end - offset, (err, res) => {
                if (err) return _getErr(err);
                let changed = [];
                vars.map(v => {
                    let value = null;
                    if (v.type === 'BOOL') {
                        // check the full byte and send all bit if there is a change 
                        value = datatypes['BYTE'].parser(res, v.start - offset, -1);
                        // for (let bitid in v.BitMap) {
                        //     let value = datatypes[v.type].parser(res, v.start - offset, bitid);
                        //     if (value !== _getBit(v.value, bitid)) {
                        //         changed.push(v);
                        //     }
                        // }
                    } else {
                        value = datatypes[v.type].parser(res, v.start - offset, v.bit);
                    }
                    if (value !== v.value) {
                        changed.push(v);
                    }
                    v.value = value;
                    return v;
                });
                resolve(changed);
            });
        });
    }

        /**
     * Write a DB and parse the result
     * @param {int} DBNr - The DB Number to read
     * @param {array} vars - Array of Var objects
     * @param {int} vars[].start - Position of the first byte
     * @param {int} [vars[].bit] - Position of the bit in the byte
     * @param {Datatype} vars[].type - Data type (BYTE, WORD, INT, etc), see {@link /s7client/?api=Datatypes|Datatypes}
     * @returns {Promise} - Resolves to the vars array with populate *value* property
     */
    _writeDB = function (DBNr, vars) {
        return new Promise((resolve, reject) => {
            if (vars.length === 0) return resolve([]);
            let end = 0;
            let offset = Number.MAX_SAFE_INTEGER;
            let v = vars[0];
            if (v.start < offset) offset = v.start;
            if (end < v.start + datatypes[v.type].bytes) {
                end = v.start + datatypes[v.type].bytes;
            }
            let buffer = datatypes[v.type].formatter(v.value)
            s7client.DBWrite(DBNr, offset, end - offset, buffer, (err, res) => {
                if (err) return _getErr(err);
                resolve(changed);
            });
        });
    }

    /**
     * Write multiple Vars
     * @param {array} vars - Array of Var objects
     * @param {int} vars[].start - Position of the first byte
     * @param {int} [vars[].bit] - Position of the bit in the byte
     * @param {Datatype} vars[].type - Data type (BYTE, WORD, INT, etc), see {@link /s7client/?api=Datatypes|Datatypes}
     * @param {string} vars[].area - Area (pe, pa, mk, db, ct, tm)
     * @param {string} [vars[].dbnr] - DB Nr if read from area=db
     * @param vars[].value - Value
     * @returns {Promise} - Resolves to the vars array with populate *value* property
     */
    _writeVars = function (vars) {
        let toWrite = vars.map(v => ({
            Area: s7client['S7AreaDB'],
            WordLen: datatypes[v.type].S7WordLen,
            DBNumber: v.dbnum,
            Start: v.type === 'BOOL' ? v.start * 8 + v.bit : v.start,
            Amount: 1,
            Data: datatypes[v.type].formatter(v.value)
        }));

        return new Promise((resolve, reject) => {
            s7client.WriteMultiVars(toWrite, (err, res) => {
                if (err) return this._getErr(err);
                let errs = [];

                res = vars.map((v, i) => {
                    if (res[i].Result !== 0) return errs.push(s7client.ErrorText(res[i].Result));
                    return v;
                });
                if (errs.length) return reject(_getErr(errs));
                resolve(res);
            });
        });
    }

    /**
     * DB X DBX 10.3 = Bool, DB X DBB 10 = Byte/Char, DB X DBW 10 = Int/Word, DB X DBD 10 = DInt/DWord, DB X DBD 10 = Real
     */
    _getDBValue = function (tag) {
        // uint mDB;
        // uint mByte;
        // uint mBit;
        // string txt = varup.str;     // remove spaces

        try {
            var variable = tag.address.toUpperCase().split(' ').join('');
            if (variable) {
                var prefix = variable.substring(0, 2);
                if (prefix === 'DB') {
                    // DB[n]"                    
                    var startpos = variable.indexOf('.');
                    var dbNum = parseInt(variable.substring(2, startpos));
                    if (dbNum >= 0) {
                        // DBX 0.0"
                        var dbType = variable.substring(startpos + 1, startpos + 4);
                        var dbStart = variable.substring(startpos + 4);
                        var result = new DbItem(dbNum);
                        result.type = tag.type.toUpperCase();
                        if (dbType === 'DBB') {
                            result.start = parseInt(dbStart);
                            // result.Len = 1;
                            if (result.start >= 0) {
                                return result;
                            }
                        } else if (dbType === 'DBW') {
                            result.start = parseInt(dbStart);
                            // result.Len = 2;
                            if (result.start >= 0) {
                                return result;
                            }
                        } else if (dbType === 'DBD') {
                            result.start = parseInt(dbStart);
                            // result.Len = 4;
                            if (result.start >= 0) {
                                return result;
                            }
                        } else if (dbType === 'DBX') {
                            var dbBool = dbStart.split('.');
                            if (dbBool.length >= 2) {
                                result.start = parseInt(dbBool[0]);
                                result.bit = parseInt(dbBool[1]);
                                // result.Len = parseInt(dbBool[1]);
                                if (result.start >= 0 && result.bit >= 0) {
                                    return result;
                                }
                            }
                        }
                    }
                }

                //         case "EB":
                //         case "IB":
                //         case "AB":
                //         case "QB":
                //         case "MB":
                //             uint bindex = uint.Parse(txt.Substring(2));
                //             return DataSize.Byte;
                //         case "EW":
                //         case "IW":
                //         case "AW":
                //         case "QW":
                //         case "MW":
                //             uint windex = uint.Parse(txt.Substring(2));
                //             return DataSize.Word;
                //         case "ED":
                //         case "ID":
                //         case "AD":
                //         case "QD":
                //         case "MD":
                //             uint dindex = uint.Parse(txt.Substring(2));
                //             return DataSize.Real;
                //         default:
                //             switch (txt.Substring(0, 1)) {
                //                 case "E":
                //                 case "I":
                //                 case "A":
                //                 case "O":
                //                 case "M":
                //                 case "Q":
                //                     break;
                //                 case "T":
                //                 case "Z":
                //                 case "C":
                //                     uint aindex = uint.Parse(txt.Substring(1));
                //                     return DataSize.Diverse;
                //                 default:
                //                     return DataSize.Undef;
                //             }

                //             string txt2 = txt.Substring(1);
                //             if (txt2.IndexOf(".") == -1) throw new Exception();

                //             mByte = uint.Parse(txt2.Substring(0, txt2.IndexOf(".")));
                //             mBit = uint.Parse(txt2.Substring(txt2.IndexOf(".") + 1));
                //             if (mBit > 7) throw new Exception();
                //             return DataSize.Bool;
                //     }
            }
        } catch (err) {

        }
        return null;
    }

    _getErr = function (s7err) {
        if (Array.isArray(s7err)) return new Error('Errors: ' + s7err.join('; '));
        return new Error(s7client.ErrorText(s7err));
    }
}

module.exports = {
    init: function (settings) {
        // deviceCloseTimeout = settings.deviceCloseTimeout || 15000;
    },
    create: function (data, logger, events) {
        return new S7client(data, logger, events);
    }
}

function DbItem(dbnum) {
    this.dbnum = dbnum;
    this.type = '';
    this.start = -1;
    this.bit = -1;
    this.Tags = [];
    this.BitMap = {};
}

function DbItems(dbnum) {
    this.DBNumber = dbnum;
    this.MaxSize = 0;
    this.Items = {};
}