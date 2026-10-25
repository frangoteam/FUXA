/**
 * MIB names resolution based on the net-snmp module store: the base modules shipped with net-snmp
 * plus the MIB files found in the mibs directory of the application (_mibs)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const OID_REGEX = /^\.?\d+(\.\d+)+$/;
const NAME_REGEX = /^([A-Za-z][\w-]*::)?[A-Za-z][\w-]*((?:\.\d+)*)$/;
const EXTRA_BASE_MODULES = ['IANAifType-MIB', 'IF-MIB'];    // shipped with net-snmp but not in loadBaseModules, in import order
const MIB_EXTENSIONS = ['.mib', '.txt', '.my'];

let snmp = null;
let store = null;
let logger = null;
let mibsDir = null;
let loadedFiles = {};       // file path -> mtime
let oidCache = {};          // name -> oid
let nameCache = {};         // oid -> name

/**
 * Init the store, done once at the first SNMP device creation
 * @param {*} _snmp net-snmp module
 * @param {*} _mibsDir directory with the user MIB files
 * @param {*} _logger
 */
function init(_snmp, _mibsDir, _logger) {
    logger = _logger;
    if (store || !_snmp || typeof _snmp.createModuleStore !== 'function') {
        if (_mibsDir) {
            mibsDir = _mibsDir;
        }
        return;
    }
    snmp = _snmp;
    mibsDir = _mibsDir;
    try {
        store = snmp.createModuleStore();
        store.loadBaseModules();
        const libMibs = path.join(path.dirname(require.resolve('net-snmp')), 'lib', 'mibs');
        EXTRA_BASE_MODULES.forEach(name => _loadFile(path.join(libMibs, `${name}.mib`)));
    } catch (err) {
        logger.error(`snmp mib store init error! ${err}`);
    }
}

/**
 * Load the new or changed MIB files of the mibs directory
 */
function refresh() {
    if (!store || !mibsDir) {
        return;
    }
    try {
        if (!fs.existsSync(mibsDir)) {
            return;
        }
        fs.readdirSync(mibsDir).filter(name => MIB_EXTENSIONS.includes(path.extname(name).toLowerCase())).sort().forEach(name => {
            const file = path.join(mibsDir, name);
            const mtime = fs.statSync(file).mtimeMs;
            if (loadedFiles[file] !== mtime) {
                loadedFiles[file] = mtime;
                if (_loadFile(file)) {
                    oidCache = {};
                    nameCache = {};
                }
            }
        });
    } catch (err) {
        logger.error(`snmp mib store refresh error! ${err}`);
    }
}

function _loadFile(file) {
    try {
        store.loadFromFile(file);
        logger.info(`snmp mib store loaded ${path.basename(file)}`, true);
        return true;
    } catch (err) {
        logger.warn(`snmp mib store cannot load ${path.basename(file)}: ${err.message || err}`);
        return false;
    }
}

/**
 * Return the numeric OID of a tag address: numeric OID or 'MODULE::name.instance'
 * @returns the OID or null if it cannot be resolved
 */
function toOid(address) {
    const value = String(address || '').trim();
    if (OID_REGEX.test(value)) {
        return value.startsWith('.') ? value.substring(1) : value;
    }
    const match = NAME_REGEX.exec(value);
    if (!match || !store) {
        return null;
    }
    const instance = match[2] || '';
    const name = value.substring(0, value.length - instance.length);
    if (!oidCache[name]) {
        try {
            oidCache[name] = store.translate(name, snmp.OidFormat.oid);
        } catch {
            return null;
        }
    }
    return oidCache[name] + instance;
}

/**
 * Return the symbolic name 'MODULE::name.instance' of an OID, with the longest known prefix
 * @returns the name or null if no prefix is known
 */
function toName(oid) {
    if (!store || !OID_REGEX.test(String(oid || ''))) {
        return null;
    }
    const parts = String(oid).replace(/^\./, '').split('.');
    for (let length = parts.length; length > 1; length--) {
        const prefix = parts.slice(0, length).join('.');
        if (!(prefix in nameCache)) {
            try {
                nameCache[prefix] = store.translate(prefix, snmp.OidFormat.module);
            } catch {
                nameCache[prefix] = null;
            }
        }
        if (nameCache[prefix]) {
            const instance = parts.slice(length);
            return nameCache[prefix] + (instance.length ? `.${instance.join('.')}` : '');
        }
    }
    return null;
}

function isSymbolic(address) {
    const value = String(address || '').trim();
    return !OID_REGEX.test(value) && NAME_REGEX.test(value);
}

/** for tests */
function reset() {
    snmp = null;
    store = null;
    mibsDir = null;
    loadedFiles = {};
    oidCache = {};
    nameCache = {};
}

module.exports = {
    init: init,
    refresh: refresh,
    toOid: toOid,
    toName: toName,
    isSymbolic: isSymbolic,
    reset: reset
};
