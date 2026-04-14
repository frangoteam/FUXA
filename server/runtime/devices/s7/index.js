/**
 * 's7': snap7 wrapper to communicate with Siemens PLC (S7)
 */

var snap7;
var datatypes;
const utils = require('../../utils');
const deviceUtils = require('../device-utils');

const MAX_MIX_ITEM = 20;

function S7client(_data, _logger, _events, _runtime) {

    var runtime = _runtime;
    var db = {};                        // Loaded Signal in DB format { DB index, start, size, ... }
    var data = JSON.parse(JSON.stringify(_data));                   // Current Device data { id, name, tags, enabled, ... }
    var logger = _logger;               // Logger
    var s7client = new snap7.S7Client();// Client node-S7
    var working = false;                // Working flag to manage overloading polling and connection
    var events = _events;               // Events to commit change to runtime
    var lastStatus = '';                // Last Device status
    var varsValue = [];                 // Signale to send to frontend { id, type, value }
    var dbItemsMap = {};                // DB Mapped Signale name with DbItem to find for set value
    var mixItemsMap = {};               // E/I/A/Q/M Mapped Signale name to find for read in polling and set value
    var overloading = 0;                // Overloading counter to mange the break connection
    var lastTimestampValue;             // Last Timestamp of asked values

    /**
     * Connect to PLC
     * Emit connection status to clients, clear all Tags values
     */
    this.connect = function () {
        return new Promise(function (resolve, reject) {
            if (data.property && data.property.rack >= 0 && data.property.slot >= 0) {
                try {
                    if (!s7client.Connected() && _checkWorking(true)) {
                        logger.info(`'${data.name}' try to connect ${data.property.address}`, true);
                        s7client.ConnectTo(data.property.address, data.property.rack, data.property.slot, function (err) {
                            if (err) {
                                logger.error(`'${data.name}' connect failed! ${err}`);
                                _emitStatus('connect-error');
                                _clearVarsValue();
                                reject();
                            } else {
                                logger.info(`'${data.name}' connected!`, true);
                                _emitStatus('connect-ok');
                                resolve();
                            }
                            _checkWorking(false);
                        });
                    } else {
                        reject();
                    }
                } catch (err) {
                    logger.error(`'${data.name}' try to connect error! ${err}`);
                    _checkWorking(false);
                    _emitStatus('connect-error');
                    _clearVarsValue();
                    reject();
                }
            } else {
                logger.error(`'${data.name}' missing connection data!`);
                _emitStatus('connect-failed');
                _clearVarsValue();
                reject();
            }
        });
    }

    /**
     * Disconnect the PLC
     * Emit connection status to clients, clear all Tags values
     */
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
                    logger.info(`'${data.name}' disconnected!`, true);
                } else {
                    logger.error(`'${data.name}' try to disconnect failed!`);
                }
                _emitStatus('connect-off');
                _clearVarsValue();
                resolve(result);
            }
        });
    }

    /**
     * Read values in polling mode
     * Update the tags values list, save in DAQ if value changed or in interval and emit values to clients
     */
    this.polling = async function () {
        if (_checkWorking(true)) {
            var readVarsfnc = [];
            for (var dbnum in db) {
                readVarsfnc.push(_readDB(parseInt(dbnum), Object.values(db[dbnum].Items)));
            }
            if (Object.keys(mixItemsMap).length) {
                utils.chunkArray(Object.values(mixItemsMap), MAX_MIX_ITEM).forEach((chunk) => {
                    readVarsfnc.push(_readVars(chunk));
                })
            }
            try {
                const result = await Promise.all(readVarsfnc);
                _checkWorking(false);
                if (result.length) {
                    let varsValueChanged = await _updateVarsValue(result);
                    lastTimestampValue = new Date().getTime();
                    _emitValues(varsValue);
                    if (this.addDaq && !utils.isEmptyObject(varsValueChanged)) {
                        this.addDaq(varsValueChanged, data.name, data.id);
                    }
                } else {
                    // console.error('not');
                }
                if (lastStatus !== 'connect-ok') {
                    _emitStatus('connect-ok');
                }
            } catch (reason) {
                if (reason && reason.stack) {
                    logger.error(`'${data.name}' _readVars error! ${reason.stack}`);
                } else {
                    logger.error(`'${data.name}' _readVars error! ${reason}`);
                }
                _checkWorking(false);
            };
        } else {
            _emitStatus('connect-busy');
        }
    }

    /**
     * Load Tags attribute to read with polling
     */
    this.load = function (_data) {
        data = JSON.parse(JSON.stringify(_data));
        db = {};
        varsValue = [];
        dbItemsMap = {};
        mixItemsMap = {};
        var count = 0;
        for (var id in data.tags) {
            try {
                var varDb = _getTagItem(data.tags[id]);
                if (varDb instanceof DbItem) {
                    if (!db[varDb.dbnum]) {
                        var grptag = new DbItems(varDb.dbnum);
                        db[varDb.dbnum] = grptag;
                    }
                    if (!db[varDb.dbnum].Items[varDb.Start]) {
                        db[varDb.dbnum].Items[varDb.Start] = varDb;
                    }
                    db[varDb.dbnum].Items[varDb.Start].Tags.push(data.tags[id]); // because you can have multiple tags at the same DB address
                    if (db[varDb.dbnum].MaxSize < varDb.Start + datatypes[varDb.type].S7WordLen) {
                        db[varDb.dbnum].MaxSize = varDb.Start + datatypes[varDb.type].S7WordLen;
                    }
                    // check Bit to Map
                    if (varDb.bit >= 0) {
                        varDb.BitMap[varDb.bit] = id;
                    }
                    count++;
                    dbItemsMap[id] = db[varDb.dbnum].Items[varDb.Start];
                    dbItemsMap[id].format = data.tags[id].format;
                } else if (varDb && !isNaN(varDb.Start)) {
                    varDb.id = id;
                    varDb.name = data.tags[id].name;
                    varDb.format = data.tags[id].format;
                    varDb.daq = data.tags[id].daq;
                    mixItemsMap[id] = varDb;
                }
            } catch (err) {
                logger.error(`'${data.name}' load error! ${err}`);
            }
        }
        logger.info(`'${data.name}' data loaded (${count})`, true);
    }

    /**
     * Return Tags values array { id: <name>, value: <value>, type: <type> }
     */
    this.getValues = function () {
        return varsValue;
    }

    /**
     * Return Tag value { id: <name>, value: <value>, ts: <lastTimestampValue> }
     */
    this.getValue = function (id) {
        if (varsValue[id]) {
            return { id: id, value: varsValue[id].value, ts: lastTimestampValue };
        }
        return null;
    }

    /**
     * Return connection status 'connect-off', 'connect-ok', 'connect-error'
     */
    this.getStatus = function () {
        return lastStatus;
    }

    /**
     * Return Tag property
     */
    this.getTagProperty = function (id) {
        if (dbItemsMap[id]) {
            return { id: id, name: id, type: dbItemsMap[id].type, format: dbItemsMap[id].format };
        } else if (mixItemsMap[id]) {
            return { id: id, name: id, type: mixItemsMap[id].type, format: mixItemsMap[id].format };
        } else {
            return null;
        }
    }

    /**
     * Set the Tag value
     * Read the current Tag object, write the value in object and send to SPS
     */
    this.setValue = async function (sigid, value) {
        var item = _getTagItem(data.tags[sigid]);
        if (item) {
            value = await deviceUtils.tagRawCalculator(value, data.tags[sigid], runtime);
            item.value = value;
            _writeVars([item], (item instanceof DbItem)).then(result => {
                logger.info(`'${data.name}' setValue(${sigid}, ${value})`, true, true);
            }, reason => {
                if (reason && reason.stack) {
                    logger.error(`'${data.name}' _writeVars error! ${reason.stack}`);
                } else {
                    logger.error(`'${data.name}' _writeVars error! ${reason}`);
                }
            });
            return true;
        }
        return false;
    }

    /**
     * Return if PLC is connected
     * Don't work if PLC will disconnect
     */
    this.isConnected = function () {
        return s7client.Connected();
    }

    /**
     * Bind the DAQ store function
     */
    this.bindAddDaq = function (fnc) {
        this.addDaq = fnc;                         // Add the DAQ value to db history
    }

    this.addDaq = null;                             // Add the DAQ value to db history

    /**
     * Return the timestamp of last read tag operation on polling
     * @returns
     */
    this.lastReadTimestamp = () => {
        return lastTimestampValue;
    }

    /**
     * Return the Daq settings of Tag
     * @returns
     */
    this.getTagDaqSettings = (tagId) => {
        return data.tags[tagId] ? data.tags[tagId].daq : null;
    }

    /**
     * Set Daq settings of Tag
     * @returns
     */
    this.setTagDaqSettings = (tagId, settings) => {
        if (data.tags[tagId]) {
            utils.mergeObjectsValues(data.tags[tagId].daq, settings);
        }
    }

    /**
     * Clear the Tags values by setting to null
     * Emit to clients
     */
    var _clearVarsValue = function () {
        for (var id in varsValue) {
            varsValue[id].value = null;
        }
        for (var dbid in db) {
            for (var itemid in db[dbid].Items) {
                db[dbid].Items[itemid].value = null;
            }
        }
        for (var mi in mixItemsMap) {
            mixItemsMap[mi].value = null;
        }
        _emitValues(varsValue);
    }

    /**
     * Update the Tags values read
     * @param {*} vars
     */
    var _updateVarsValue = async (vars) => {
        var someval = false;
        var tempTags = {};
        for (var vid in vars) {
            let items = vars[vid];
            for (var itemidx in items) {
                const changed = items[itemidx].changed;
                if (items[itemidx] instanceof DbItem) {
                    let type = items[itemidx].type;
                    let value = items[itemidx].value;
                    let tags = items[itemidx].Tags;
                    tags.forEach(tag => {
                        tempTags[tag.id] = {
                            id: tag.id,
                            rawValue: value,
                            type: type,
                            daq: tag.daq,
                            changed: changed,
                            tagref: tag
                        };
                        if (type === 'BOOL') {
                            try {
                                let pos = parseInt(tag.address.charAt(tag.address.length - 1));
                                tempTags[tag.id].rawValue = _getBit(value, pos) ? 1 : 0;
                            } catch (err) { }
                        }
                        someval = true;
                    });
                } else {
                    if (items[itemidx].type === 'BOOL') {
                        try {
                            items[itemidx].value = (_getBit(items[itemidx].value, items[itemidx].bit)) ? 1 : 0;
                        } catch (err) { }
                    }
                    tempTags[items[itemidx].id] = {
                        id: items[itemidx].id,
                        rawValue: items[itemidx].value,
                        type: items[itemidx].type,
                        daq: items[itemidx].daq,
                        changed: changed,
                        tagref: items[itemidx]
                    };
                    someval = true;
                }
            }
        }
        if (someval) {
            const timestamp = new Date().getTime();
            var result = {};
            for (var id in tempTags) {
                if (!utils.isNullOrUndefined(tempTags[id].rawValue)) {
                    tempTags[id].value = await deviceUtils.tagValueCompose(tempTags[id].rawValue, varsValue[id] ? varsValue[id].value : null, tempTags[id].tagref, runtime);
                    tempTags[id].timestamp = timestamp;
                    if (this.addDaq && deviceUtils.tagDaqToSave(tempTags[id], timestamp)) {
                        result[id] = tempTags[id];
                    }
                }
                varsValue[id] = tempTags[id];
                varsValue[id].changed = false;
            }
            return result;
        }
        return null;
    }

    //#region Bit Manipolation
    _getBit = function (number, bitPosition) {
        return ((number >> bitPosition) % 2 != 0)
    }

    _setBit = function (number, bitPosition) {
        return number | 1 << bitPosition;
    }

    _clearBit = function (number, bitPosition) {
        return number & ~(1 << bitPosition);
    }

    _toggleBit = function (number, bitPosition) {
        return _getBit(number, bitPosition) ? _clearBit(number, bitPosition) : _setBit(number, bitPosition);
    }
    //#endregion

    /**
     * Emit the PLC Tags values array { id: <name>, value: <value>, type: <type> }
     * @param {*} values
     */
    var _emitValues = function (values) {
        events.emit('device-value:changed', { id: data.id, values: values });
    }

    /**
     * Emit the PLC connection status
     * @param {*} status
     */
    var _emitStatus = function (status) {
        lastStatus = status;
        events.emit('device-status:changed', { id: data.id, status: status });
    }

    /**
     * Used to manage the async connection and polling automation (that not overloading)
     * @param {*} check
     */
    var _checkWorking = function (check) {
        if (check && working) {
            overloading++;
            logger.warn(`'${data.name}' working (connection || polling) overload! ${overloading}`);
            // !The driver don't give the break connection
            if (overloading >= 3) {
                s7client.Disconnect();
            } else {
                return false;
            }
        }
        working = check;
        overloading = 0;
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
    var _readDB = function (DBNr, vars) {
        return new Promise((resolve, reject) => {
            if (vars.length === 0) return resolve([]);

            let end = 0;
            let offset = Number.MAX_SAFE_INTEGER;
            vars.forEach(v => {
                if (v.Start < offset) offset = v.Start;
                if (end < v.Start + datatypes[v.type].bytes) {
                    end = v.Start + datatypes[v.type].bytes;
                }
            });
            s7client.DBRead(DBNr, offset, end - offset, (err, res) => {
                if (err) {
                    logger.error(`'${data.name}' ${err}: ${_getErr(err)}`, false);
                } else {
                    vars.map(v => {
                        let value = null;
                        if (v.type === 'BOOL') {
                            // check the full byte and send all bit if there is a change
                            value = datatypes['BYTE'].parser(res, v.Start - offset, -1);
                        } else {
                            value = datatypes[v.type].parser(res, v.Start - offset, v.bit);
                        }
                        v.changed = value !== v.value;
                        v.value = value;
                        return v;
                    });
                }
                resolve(vars);
            });
        });
    }

    /**
     * Read multiple Vars
     * @param {*} vars
     */
    var _readVars = function (vars) {
        return new Promise((resolve, reject) => {
            s7client.ReadMultiVars(vars, (err, res) => {
                if (err) return _getErr(err);
                let errs = [];
                res = vars.map((v, i) => {
                    let value = null;
                    if (res[i].Result !== 0) {
                        errs.push(`${v.name} - ${s7client.ErrorText(res[i].Result)}`);
                    } else {
                        try {
                            if (v.type === 'BOOL') {
                                // check the full byte and send all bit if there is a change
                                value = datatypes['BYTE'].parser(res[i].Data);//, v.Start, -1);
                            } else {
                                value = datatypes[v.type].parser(res[i].Data);
                            }
                            v.changed = value !== v.value;
                            v.value = value;
                            return v;
                        } catch { }
                    }
                });
                if (errs.length) return reject(_getErr(errs));
                resolve(vars);
            });
        });
    }

    /**
     * Write a DB and parse the result
     * @param {int} DBNr - The DB Number to read
     * @param {array} vars - Array of Var objects
     * @param {int} vars[].Start - Position of the first byte
     * @param {int} [vars[].bit] - Position of the bit in the byte
     * @param {Datatype} vars[].type - Data type (BYTE, WORD, INT, etc), see {@link /s7client/?api=Datatypes|Datatypes}
     * @returns {Promise} - Resolves to the vars array with populate *value* property
     */
    var _writeDB = function (DBNr, vars) {
        return new Promise((resolve, reject) => {
            if (vars.length === 0) return resolve([]);
            let end = 0;
            let offset = Number.MAX_SAFE_INTEGER;
            let v = vars[0];
            if (v.Start < offset) offset = v.Start;
            if (end < v.Start + datatypes[v.type].bytes) {
                end = v.Start + datatypes[v.type].bytes;
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
     * @param {int} vars[].Start - Position of the first byte
     * @param {int} [vars[].bit] - Position of the bit in the byte
     * @param {Datatype} vars[].type - Data type (BYTE, WORD, INT, etc), see {@link /s7client/?api=Datatypes|Datatypes}
     * @param {string} vars[].area - Area (pe, pa, mk, db, ct, tm)
     * @param {string} [vars[].dbnr] - DB Nr if read from area=db
     * @param vars[].value - Value
     * @returns {Promise} - Resolves to the vars array with populate *value* property
     */
    var _writeVars = function (vars) {
        var toWrite = vars.map(v => ({
            Area: v.Area,
            WordLen: datatypes[v.type].S7WordLen,
            DBNumber: v.dbnum,
            Start: v.type === 'BOOL' ? v.Start * 8 + v.bit : v.Start,
            Amount: 1,
            Data: datatypes[v.type].formatter(parseFloat(v.value))
        }));
        return new Promise((resolve, reject) => {
            s7client.WriteMultiVars(toWrite, (err, res) => {
                if (err) return _getErr(err);
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
     * Return the Tag object (DbItem) with value
     * DB X DBX 10.3 = Bool, DB X DBB 10 = Byte/Char, DB X DBW 10 = Int/Word, DB X DBD 10 = DInt/DWord, DB X DBD 10 = Real
     */
    var _getTagItem = function (tag) {
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
                        result.Area = s7client['S7AreaDB'];
                        if (dbType === 'DBB') {
                            result.Start = parseInt(dbStart);
                            if (result.Start >= 0) {
                                return result;
                            }
                        } else if (dbType === 'DBW') {
                            result.Start = parseInt(dbStart);
                            if (result.Start >= 0) {
                                return result;
                            }
                        } else if (dbType === 'DBD') {
                            result.Start = parseInt(dbStart);
                            if (result.Start >= 0) {
                                return result;
                            }
                        } else if (dbType === 'DBX') {
                            var dbBool = dbStart.split('.');
                            if (dbBool.length >= 2) {
                                result.Start = parseInt(dbBool[0]);
                                result.bit = parseInt(dbBool[1]);
                                if (result.Start >= 0 && result.bit >= 0) {
                                    return result;
                                }
                            }
                        }
                    }
                } else {
                    var type = tag.type.toUpperCase();
                    var len = datatypes[type].S7WordLen;
                    switch (prefix) {
                        case 'EB':
                        case 'IB':
                        case 'EW':
                        case 'IW':
                        case 'ED':
                        case 'ID':
                            return { Area: s7client['S7AreaPE'], WordLen: len, Start: parseInt(variable.substring(2)), Amount: 1, type: type };
                        case 'AB':
                        case 'QB':
                        case 'AW':
                        case 'QW':
                        case 'AD':
                        case 'QD':
                            return { Area: s7client['S7AreaPA'], WordLen: len, Start: parseInt(variable.substring(2)), Amount: 1, type: type };
                        case 'MB':
                        case 'MW':
                        case 'MD':
                            return { Area: s7client['S7AreaMK'], WordLen: len, Start: parseInt(variable.substring(2)), Amount: 1, type: type };
                        default:
                            len = datatypes['BYTE'].S7WordLen;
                            var start = parseInt(variable.substring(1, variable.indexOf('.')));
                            var bit = parseInt(variable.substring(variable.indexOf('.') + 1));
                            switch (prefix.substring(0, 1)) {
                                case 'E':
                                case 'I':
                                    return { Area: s7client['S7AreaPE'], WordLen: len, Start: start, Amount: 1, type: type, bit: bit };
                                case 'A':
                                case 'Q':
                                    return { Area: s7client['S7AreaPA'], WordLen: len, Start: start, Amount: 1, type: type, bit: bit };
                                case 'M':
                                    return { Area: s7client['S7AreaMK'], WordLen: len, Start: start, Amount: 1, type: type, bit: bit };
                                case 'O':
                                case 'T':
                                case 'Z':
                                case 'C':
                                    return null;
                                default:
                                    return null;
                            }
                    }
                }
            }
        } catch (err) {

        }
        return null;
    }

    /**
     * Return error message, from error code
     * @param {*} s7err
     */
    var _getErr = function (s7err) {
        if (Array.isArray(s7err)) return new Error('Errors: ' + s7err.join('; '));
        return new Error(s7client.ErrorText(s7err));
    }
}

module.exports = {
    init: function (settings) {
        // deviceCloseTimeout = settings.deviceCloseTimeout || 15000;
    },
    create: function (data, logger, events, manager, runtime) {
        try { snap7 = require('node-snap7'); } catch { }
        if (!snap7 && manager) { try { snap7 = manager.require('node-snap7'); } catch { } }
        if (snap7) datatypes = require('./datatypes');
        else return null;
        return new S7client(data, logger, events, runtime);
    }
}

function DbItem(dbnum) {
    this.dbnum = dbnum;
    this.type = '';
    this.Area = -1;
    this.Start = -1;
    this.bit = -1;
    this.Tags = [];
    this.BitMap = {};
}

function DbItems(dbnum) {
    this.DBNumber = dbnum;
    this.MaxSize = 0;
    this.Items = {};
}