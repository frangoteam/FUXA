/*
* Plugins manager: add and remove npm package
*/

'use strict';
var fs = require('fs');
const path = require('path');
var device = require('../devices/device');
const { createRuntimeService, listInstalledPackages } = require('./npm-runtime-service');
var events = require("../events").create();

var settings;                   // Application settings
var logger;                     // Application logger
var manager;

/**
 * Plugins supported
 */
const PluginGroupType = {
    connectionDevice: 'connection-device',
    connectionDatabase: 'connection-database',
    chartReport: 'chart-report',
    service: 'service',
}

var plugins = createDefaultPlugins();


/**
 * Init plugin resource
 * @param {*} _settings
 * @param {*} log
 */
function init(_settings, log) {
    settings = _settings;
    logger = log;
    manager = createRuntimeService({ packageDir: settings.packageDir, logger });

    // Init Plugins
    return new Promise(function (resolve, reject) {
        plugins = _checkPluginsSupported();
        // define the event listener to check if ready
        var checkInstalled = function () {
            var waiting = 0;
            Object.values(plugins).forEach((pg) => {
                if (pg.current && events.listenerCount(pg.name)) {
                    waiting++;
                }
            });
            if (!waiting) {
                resolve();
            }
        }
        var towait = false;
        Object.values(plugins).forEach(async (pg) => {
            if (pg.current) {
                towait = true;
                events.once(pg.name, checkInstalled);
            }
        });
        if (!towait) {
            resolve();
        }
        // add plugins
        const installedSnapshot = plugins;
        Object.values(plugins).forEach(async (pg) => {
            if (pg.current) {
                await addPlugin(pg, { installed: installedSnapshot, refreshInstalled: false }).then(result => {
                    logger.info(`plugin-installed ${pg.name} ${pg.current}`, true);
                    events.emit(pg.name);
                }).catch(function (err) {
                    logger.error(`plugins.add-plugin error! ${err}`);
                });
                // addfnc.push(addPlugin(pg));
            }
        });

        // var plgs = Object.values(plugins);
        // for (var i in plgs) {
        //     if (plgs[i].current) {
        //         await addPlugin(plgs[i]).then(result => {
        //             logger.info('plugin-installed: ' + plgs[i].name + ' ' + plgs[i].current);
        //         }).catch(function (err) {
        //             logger.error('plugins.addPlugin error: ' + err);
        //             // logger.error("runtime.failed-to-init users");
        //         });
        //         // addfnc.push(addPlugin(pg));
        //     }
        // }

        // if (addfnc.length > 0) {
        //     Promise.all(addfnc).then(result => {
        //         logger.info('plugins-init-successful!');
        //         resolve();
        //     }, reason => {
        //         if (reason && reason.stack) {
        //             logger.error('plugins.addPlugin: ' + reason.stack);
        //         } else {
        //             logger.error('plugins.addPlugin error: ' + reason);
        //         }
        //         _checkWorking(false);
        //         reject();
        //     });
        // } else {
        //     logger.info('plugins-init-successful!');
        //     resolve();
        // }
    });
}

/**
 * Get the plugin
 */
function getPlugin(type) {
    var plugin;
    Object.values(plugins).forEach((pg) => {
        if (type && type.startsWith(pg.type)) {
            plugin = pg;
        }
    });
    return plugin;
}

/**
 * Get the plugin list
 */
function getPlugins() {
    return new Promise(function (resolve, reject) {
        var plg = _checkPluginsSupported();
        if (Object.values(plg).length > 0) {
            resolve(Object.values(plg));
        } else {
            resolve();
        }

    });
}

/**
 * Install plugin, install
 */
async function addPlugin(plugin, options) {
    const addOptions = _normalizeAddPluginOptions(options);
    const normalized = _normalizePlugin(plugin);
    if (!normalized) {
        throw new Error('Invalid plugin');
    }
    const installed = addOptions.installed || _checkPluginsSupported();
    const current = installed[normalized.name];
    const isInstalled = current && current.current;
    const needsRuntimeInstall = normalized.pkg || normalized.dynamicPackage || !isInstalled;

    if (needsRuntimeInstall && !isInstalled) {
        normalized.current = await manager.installPackage(normalized.name, normalized.version);
        normalized.pkg = true;
    } else if (current) {
        normalized.current = current.current;
        normalized.pkg = current.pkg;
    }

    if (normalized.module && normalized.type) {
        await device.loadPlugin(normalized.type, normalized.module);
    }
    plugins[normalized.name] = normalized;
    if (addOptions.refreshInstalled !== false) {
        plugins = _checkPluginsSupported();
    }
    return normalized;
}

/**
 * Remove plugin, uninstall
 */
function removePlugin(plugin) {
    return new Promise(async function (resolve, reject) {
        try {
            const normalized = _normalizePlugin(plugin);
            if (!normalized) {
                reject(new Error('Invalid plugin'));
                return;
            }
            if (!manager.isRuntimeManaged(normalized.name)) {
                reject(new Error(`Package '${normalized.name}' is not installed in the isolated runtime`));
                return;
            }
            await manager.uninstallPackage(normalized.name);
            plugins = _checkPluginsSupported();
            resolve();
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Get the supported plugins list by check in node_modules if installed
 */
function _checkPluginsSupported() {
    const registry = createDefaultPlugins();
    Object.values(registry).forEach((pg) => {
        pg.current = '';
        pg.canRemove = false;
    });
    const installed = _scanInstalledPlugins();
    const rootPackages = installed.rootPackages;
    Object.entries(rootPackages).forEach(([name, version]) => {
        if (registry[name]) {
            registry[name].current = version;
        }
    });

    const runtimePackages = installed.runtimePackages;
    Object.entries(runtimePackages).forEach(([name, version]) => {
        if (!registry[name]) {
            return;
        }
        registry[name].current = version;
        registry[name].pkg = true;
        registry[name].dynamicPackage = true;
        registry[name].canRemove = installed.runtimeManagedNames.has(name);
    });

    plugins = registry;
    return registry;
}

function _scanInstalledPlugins() {
    const rootModules = _getRootNodeModules();
    const rootPackages = listInstalledPackages(rootModules);
    const runtimePackages = manager ? manager.getInstalledPackages() : {};
    const runtimePaths = manager ? manager.getPaths() : null;
    const runtimeManagedNames = new Set(
        runtimePaths ? Object.keys(listInstalledPackages(runtimePaths.runtimeDir)) : []
    );
    return {
        rootPackages,
        runtimePackages,
        runtimeManagedNames,
    };
}

function _getRootNodeModules() {
    let modulePath = path.resolve(__dirname, '../../node_modules');
    if (!fs.existsSync(modulePath)) {
        modulePath = path.resolve(__dirname, '../../../node_modules');
    }
    return modulePath;
}

function _normalizePlugin(plugin) {
    if (!plugin) {
        return null;
    }
    if (typeof plugin === 'string') {
        return plugins[plugin] || new Plugin(plugin, '', plugin, 'latest', PluginGroupType.service, true);
    }
    if (plugin.name && plugins[plugin.name]) {
        const knownPlugin = plugins[plugin.name];
        return Object.assign(new Plugin(
            knownPlugin.name,
            knownPlugin.module,
            knownPlugin.type,
            plugin.version || knownPlugin.version,
            plugin.group || knownPlugin.group,
            true
        ), knownPlugin, plugin);
    }
    if (plugin.name) {
        const customPlugin = new Plugin(
            plugin.name,
            plugin.module || '',
            plugin.type || plugin.name,
            plugin.version || 'latest',
            plugin.group || PluginGroupType.service,
            true
        );
        customPlugin.custom = true;
        customPlugin.dynamicPackage = true;
        return Object.assign(customPlugin, plugin);
    }
    return null;
}

function _normalizeAddPluginOptions(options) {
    if (options === true || options === false || options === undefined || options === null) {
        return {};
    }
    return options;
}

function createDefaultPlugins() {
    const registry = {};
    registry['node-opcua'] = new Plugin('node-opcua', './opcua', 'OPCUA', '2.149.0', PluginGroupType.connectionDevice, true);
    registry['modbus-serial'] = new Plugin('modbus-serial', './modbus', 'Modbus', '8.0.9', PluginGroupType.connectionDevice, true);
    registry['node-bacnet'] = new Plugin('node-bacnet', './bacnet', 'BACnet', '0.2.4', PluginGroupType.connectionDevice, true);
    registry['node-snap7'] = new Plugin('node-snap7', './s7', 'SiemensS7', '1.0.7', PluginGroupType.connectionDevice, true);
    registry['ads-client'] = new Plugin('ads-client', './ads-client', 'ADSclient', '2.1.0', PluginGroupType.connectionDevice, true);
    registry['nodepccc'] = new Plugin('nodepccc', './ethernetip', 'EthernetIP', '0.1.17', PluginGroupType.connectionDevice, true);
    registry['odbc'] = new Plugin('odbc', './odbc', 'ODBC', '2.4.8', PluginGroupType.connectionDatabase, true);
    registry['chart.js'] = new Plugin('chart.js', './chartjs', 'Chart', '2.9.4', PluginGroupType.chartReport, true);
    registry['chartjs-node-canvas'] = new Plugin('chartjs-node-canvas', 'chartjs-canvas', 'Chart', '3.2.0', PluginGroupType.chartReport, true);
    registry['onoff'] = new Plugin('onoff', './onoff', 'GPIO', '6.0.3', PluginGroupType.connectionDevice, true);
    registry['node-webcam'] = new Plugin('node-webcam', './node-webcam', 'WebCam', '0.8.2', PluginGroupType.connectionDevice, true);
    registry['mcprotocol'] = new Plugin('mcprotocol', './mcprotocol', 'MELSEC', '0.1.2', PluginGroupType.connectionDevice, true);
    registry['node-red'] = new Plugin('node-red', './node-red', 'node-red', '4.1.0', PluginGroupType.service, true);
    registry['redis'] = new Plugin('redis', './redis', 'REDIS', '5.8.2', PluginGroupType.connectionDevice, true);
    return registry;
}

module.exports = {
    init: init,
    getPlugin: getPlugin,
    getPlugins: getPlugins,
    addPlugin: addPlugin,
    removePlugin: removePlugin,

    get manager() { return manager },
};

function Plugin(name, module, type, version, group, dinamic) {
    this.name = name;
    this.module = module;
    this.type = type;
    this.version = version;
    this.current = '';
    this.pkg = false;
    this.group = group;
    this.dinamic = false || dinamic;
    this.dynamicPackage = false;
    this.custom = false;
    this.canRemove = false;
}
