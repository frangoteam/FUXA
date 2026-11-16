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
 * Load the new or changed MIB files of the mibs directory.
 * The files are loaded in dependency order (the IMPORTS of a file are loaded first, the parser does not resolve an import
 * that arrives later), a file that fails is retried at the end of the pass; after the pass the name translations of all
 * the user modules are rebuilt because the parser can mount objects of the earlier modules when a later one is loaded.
 */
function refresh() {
    if (!store || !mibsDir) {
        return;
    }
    try {
        if (!fs.existsSync(mibsDir)) {
            return;
        }
        const changed = [];
        fs.readdirSync(mibsDir).filter(name => MIB_EXTENSIONS.includes(path.extname(name).toLowerCase())).sort().forEach(name => {
            const file = path.join(mibsDir, name);
            const mtime = fs.statSync(file).mtimeMs;
            if (loadedFiles[file] !== mtime) {
                changed.push({ file: file, mtime: mtime });
            }
        });
        if (!changed.length) {
            return;
        }
        const ordered = _dependencyOrder(changed);
        const failed = ordered.filter(entry => !_loadFile(entry.file));
        const stillFailed = failed.filter(entry => !_loadFile(entry.file));
        changed.forEach(entry => {
            loadedFiles[entry.file] = entry.mtime;      // a failed file is retried when it is modified
        });
        stillFailed.forEach(entry => logger.warn(`snmp mib store ${path.basename(entry.file)} not loaded, upload it again after fixing it or its imports`));
        _rebuildTranslations();
        oidCache = {};
        nameCache = {};
    } catch (err) {
        logger.error(`snmp mib store refresh error! ${err}`);
    }
}

/**
 * Order the files so that a module is loaded after the modules it imports from (when they are among the files)
 */
function _dependencyOrder(entries) {
    entries.forEach(entry => {
        let text = '';
        try {
            text = fs.readFileSync(entry.file, 'utf8');
        } catch { /* loadFromFile reports the error */ }
        const definition = /^\s*([A-Za-z][\w-]*)\s+DEFINITIONS\s*::=\s*BEGIN/m.exec(text);
        entry.module = definition ? definition[1] : path.basename(entry.file, path.extname(entry.file));
        const importsSection = /IMPORTS([\s\S]*?);/.exec(text);
        entry.imports = importsSection ? Array.from(importsSection[1].matchAll(/FROM\s+([A-Za-z][\w-]*)/g), match => match[1]) : [];
    });
    const byModule = {};
    entries.forEach(entry => { byModule[entry.module] = entry; });
    const ordered = [];
    const visited = new Set();
    const visit = (entry) => {
        if (visited.has(entry)) {
            return;
        }
        visited.add(entry);
        entry.imports.forEach(moduleName => {
            if (byModule[moduleName] && byModule[moduleName] !== entry) {
                visit(byModule[moduleName]);
            }
        });
        ordered.push(entry);
    };
    entries.forEach(visit);
    return ordered;
}

/**
 * net-snmp builds the translations of a module only when the module is loaded: the objects of a module mounted
 * later (when the module it imports from is loaded) get their names here
 */
function _rebuildTranslations() {
    store.getModuleNames(false).forEach(moduleName => {
        try {
            store.addTranslationsForModule(moduleName);
        } catch (err) {
            logger.warn(`snmp mib store translations of ${moduleName}: ${err.message || err}`);
        }
    });
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
