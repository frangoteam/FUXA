/*
* Plugins manager: add and remove npm package
*/

'use strict';
var npm = require('npm');
var fs = require('fs');
const path = require('path');
var device = require('../devices/device');
const PluginManager = require('live-plugin-manager');

var settings;                   // Application settings
var logger;                     // Application logger
var manager;

/**
 * Plugins supported
 */
var plugins = {};
plugins['node-opcua'] = new Plugin('node-opcua', './opcua', 'OPCUA', '0.7.2');
plugins['modbus-serial'] = new Plugin('modbus-serial', './modbus', 'Modbus', '8.0.1');
plugins['bacstack'] = new Plugin('bacstack', './bacnet', 'BACnet', '0.0.1-beta.13');
plugins['node-snap7'] = new Plugin('node-snap7', './s7', 'SiemensS7', '1.0.1');
plugins['onoff'] = new Plugin('onoff', './raspy', 'Raspberry', '6.0.1');

/**
 * Init plugin resource
 * @param {*} _settings 
 * @param {*} log 
 */
function init(_settings, log) {
    settings = _settings;
    logger = log;
    manager = new PluginManager.PluginManager({ cwd: settings.packageDir, pluginsPath: settings.packageDir });

    // Init Plugins
    return new Promise(function (resolve, reject) {
        var plg = _checkPluginsSupported();
        plugins = plg;
        // var addfnc = [];
        Object.values(plugins).forEach( async (pg) => {
            if (pg.current) {
                addPlugin(pg).then(result => {
                    logger.info('plugin-installed: ' + pg.name + ' ' + pg.current);
                }).catch(function (err) {
                    logger.error('plugins.addPlugin error: ' + err);
                });
                // addfnc.push(addPlugin(pg));
            }
        });
        setTimeout(() => {
            resolve();
        }, 14000);

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
                console.log('plugin: ' + plugin.name);
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

function _addPlugin(plugin) {
    return new Promise(function (resolve, reject) {
        if (plugin) {
            try {
                if (plugin.pkg) {
                    manager.installFromNpm(plugin.name, plugin.version).then(function (data) {
                        device.loadPlugin(plugin.type, plugin.module);
                        resolve();
                    }).catch(function (err) {
                        reject(err);
                    });
                } else {
                    device.loadPlugin(plugin.type, plugin.module);
                    resolve();
                }
                // npm.load({ prefix: settings.appDir }, function (err) {
                //     // handle errors

                //     // install module ffi
                //     npm.commands.install([plugin], function (er, data) {
                //         // log errors or data
                //         if (err) {
                //             reject(err);
                //         } else {
                //             resolve();
                //             let plug = Object.values(plugins).find(p => plugin.startsWith(p.type));
                //             if (plug) {
                //                 device.loadPlugin(plug.type);
                //             }
                //         }
                //     });

                //     npm.on('out', function (message) {
                //         // log installation progress
                //         console.log(message);
                //     });
                // });
            } catch (err) {
                reject(err);
            }
        } else {
            reject();
        }
    });
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
                // npm.load({ prefix: settings.appDir }, function (err) {
                //     // handle errors

                //     // install module ffi
                //     npm.commands.uninstall([plugin], function (er, data) {
                //         // log errors or data
                //         if (err) {
                //             reject(err);
                //         } else {
                //             resolve();
                //         }
                //         let plug = Object.values(plugins).find(p => plugin.startsWith(p.type));
                //         if (plug) {
                //             // device.loadPlugin(plug.type);
                //         }
                //     });

                //     npm.on('out', function (message) {
                //         // log installation progress
                //         console.log(message);
                //     });
                // });
            } catch (err) {
                reject(err);
            }
        } else {
            reject();
        }

        // _checkPluginsSupported().then(plg => {
        //     if (Object.values(plg).length > 0) {
        //         resolve(Object.values(plg));
        //     } else {
        //         resolve();
        //     }
        // }).catch(function (err) {
        //     logger.error('plugins.failed-to-removeplugin: ' + err);
        //     reject(err);
        // });
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
    module = path.resolve(__dirname, "../../node_modules");
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
        }
    });
    return plugins;
}

module.exports = {
    init: init,
    getPlugin: getPlugin,
    getPlugins: getPlugins,
    addPlugin: addPlugin,
    removePlugin: removePlugin
};

function Plugin(name, module, type, version) {
    this.name = name;
    this.module = module;
    this.type = type;
    this.version = version;
    this.current = '';
    this.pkg = false;
}