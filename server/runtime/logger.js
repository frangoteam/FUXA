'use strict';

const { createLogger, format, transports } = require('winston');
const fs = require('fs');
const path = require('path');

var initialized = false;
var filelogger;
var settings;
var logDir = '';

const env = process.env.NODE_ENV || 'development';
const logFileName = 'fuxa.log';
const errorFileName = 'fuxa-err.log';

var log = module.exports = {

    init: function (_settings) {
        settings = _settings;
        if (settings.logDir) {
            logDir = settings.logDir;
        }
        filelogger = createLogger({
            level: env === 'production' ? 'info' : 'debug',
            format: format.combine(
                // format.label({ label: path.basename(caller) }),
                format.timestamp(),
                format.printf(info => `${info.timestamp} [${info.level}] ${info.message}`)
            ),
            transports: [
                // new transports.Console({
                //     level: 'info',
                //     format: format.combine(
                //       format.colorize(),
                //       format.timestamp({format: 'YYYY-MM-DD HH:mm:ss.fff'}),
                //       format.printf(info => `${info.timestamp} [${info.level}] ${info.message}`)
                //     )
                // }),                
                new (transports.File)({
                    level: 'info',
                    filename: `${logDir}/${logFileName}`,
                    maxsize: 1048576, // 1MB
                    maxFiles: 5,
                    json: false
                }),
                new (transports.File)({
                    level: 'error',
                    filename: `${logDir}/${errorFileName}`,
                    maxsize: 1048576,//5242880, // 1MB
                    maxFiles: 5,
                    json: false
                })
            ]
        });
        initialized = true;
    },

    debug: function (str, flag) {
        //	debug color: Cyan
        console.log("\x1B[36m" + new Date().toISOString() + ' [DBG]  ' + "\t" + processInput(str) + "\x1B[39m");
        if (initialized && (null == flag || true === flag)) {
            filelogger.debug(str);
        }
    },
    info: function (str, notConsoleLog = false, onlyFull = false) {
        //	debug color: Default (White / Black)
        if (initialized && notConsoleLog === false) {
            console.log(new Date().toISOString() + ' [INF] ' + "\t" + processInput(str));
        }
        if (initialized && !(onlyFull && !settings.logFull)) {
            filelogger.info(str);
        }
    },
    trace: function (str, flag) {
        //	trace color: Grey
        console.error("\x1B[90m" + new Date().toISOString() + ' [TRA] ' + "\t" + processInput(str) + "\x1B[0m");
        if (initialized && (null == flag || true === flag)) {
            filelogger.trace(str);
        }
    },
    warn: function (str, flag) {
        //	warn color: Yellow
        console.log("\x1B[33m" + new Date().toISOString() + ' [WAR] ' + "\t" + processInput(str) + "\x1B[39m");
        if (initialized && (null == flag || true === flag)) {
            filelogger.warn(str);
        }
    },
    error: function (str, flag) {
        //	error color: Red
        console.error("\x1B[31m" + new Date().toISOString() + ' [ERR] ' + "\t" + processInput(str) + "\x1B[0m");
        if (initialized && (null == flag || true === flag)) {
            filelogger.error(str);
        }
    },
    logDir: function () {
        return logDir;
    },
    logFile: function () {
        return `${logDir}/${logFileName}`;
    },
    errorFile: function () {
        return `${logDir}/${errorFileName}`;
    }
}

function processInput(param) {
    if ('string' == typeof param) {
        return param;
    }
    else {
        return JSON.stringify(param);
    }
};