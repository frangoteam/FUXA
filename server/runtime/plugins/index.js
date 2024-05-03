/*
* Plugins manager: add and remove npm package
*/

'use strict';
var fs = require('fs');
const path = require('path');
var device = require('../devices/device');
const PluginManager = require('live-plugin-manager');
var events = require("../events").create();

var settings;                   // Application settings
var logger;                     // Application logger
var manager;

/**
 * Plugins supported
 */
var plugins = {};
plugins['node-opcua'] = new Plugin('node-opcua', './opcua', 'OPCUA', '2.78.0');
plugins['modbus-serial'] = new Plugin('modbus-serial', './modbus', 'Modbus', '8.0.9');
plugins['node-bacnet'] = new Plugin('node-bacnet', './bacnet', 'BACnet', '0.2.4');
plugins['node-snap7'] = new Plugin('node-snap7', './s7', 'SiemensS7', '1.0.6');
plugins['nodepccc'] = new Plugin('nodepccc', './ethernetip', 'EthernetIP', '0.1.17', true);
plugins['odbc'] = new Plugin('odbc', './odbc', 'ODBC', '2.4.8');
// plugins['influxdb-client'] = new Plugin('@influxdata/influxdb-client', '../storage/influxdb', 'influxDB', '1.25.0', true);
// plugins['onoff'] = new Plugin('onoff', './raspy', 'Raspberry', '6.0.1');

/**
 * Init plugin resource
 * @param {*} _settings 
 * @param {*} log 
 */
function init(_settings, log) {
    settings = _settings;
    logger = log;
    manager = new PluginManager.PluginManager({ pluginsPath: settings.packageDir });

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
        Object.values(plugins).forEach(async (pg) => {
            if (pg.current) {
                await addPlugin(pg).then(result => {
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
        if (type.startWith(pg.type)) {
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
async function addPlugin(plugin) {
    if (plugin) {
        try {
            if (plugin.pkg) {
                await manager.installFromNpm(plugin.name, plugin.version).then(async function (data) {
                    await device.loadPlugin(plugin.type, plugin.module);
                }).catch(function (err) {
                });
            } else {
                await device.loadPlugin(plugin.type, plugin.module);
            }
        } catch (err) {
        }
    } else {
    }
}

/**
 * Remove plugin, uninstall
 */
function removePlugin(plugin) {
    return new Promise(function (resolve, reject) {
        if (plugin) {
            try {
                manager.uninstall(plugin).then(function (data) {
                    resolve();
                }).catch(function (err) {
                    reject(err);
                });
            } catch (err) {
                reject(err);
            }
        } else {
            reject();
        }
    });
}

/**
 * Get the supported plugins list by check in node_modules if installed
 */
function _checkPluginsSupported() {
    Object.values(plugins).forEach((pg) => {
        pg.current = '';
    });
    // check in node_modules
    module = path.resolve(__dirname, '../../node_modules');
    if (!fs.existsSync(module)) {
        module = path.resolve(__dirname, '../../../node_modules');
    }
    var dirs = fs.readdirSync(module);
    var data = {};
    dirs.forEach(function (dir) {
        try {
            var file = path.resolve(module, dir + '/package.json');
            if (fs.existsSync(file)) {
                var json = require(file);
                if (json) {
                    var name = json.name;
                    var version = json.version;
                    data[name] = version;
                    if (plugins[name]) {
                        plugins[name].current = version;
                    }
                }
            }
        } catch (err) {
            logger.error(err);
        }
    });
    // check in _pkg
    var module = settings.packageDir;
    var dirs = fs.readdirSync(module);
    var data = {};
    dirs.forEach(function (dir) {
        try {
            var file = path.resolve(module, dir + '/package.json');
            if (fs.existsSync(file)) {
                var json = require(file);
                if (json) {
                    var name = json.name;
                    var version = json.version;
                    data[name] = version;
                    if (plugins[name]) {
                        plugins[name].current = version;
                        plugins[name].pkg = true;
                    }
                }
            }
        } catch (err) {
            logger.error(err);
        }
    });
    return plugins;
}

module.exports = {
    init: init,
    getPlugin: getPlugin,
    getPlugins: getPlugins,
    addPlugin: addPlugin,
    removePlugin: removePlugin,

    get manager() { return manager },
};

function Plugin(name, module, type, version, dinamic) {
    this.name = name;
    this.module = module;
    this.type = type;
    this.version = version;
    this.current = '';
    this.pkg = false;
    this.dinamic = false || dinamic;
}