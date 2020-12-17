'use strict';

const { createLogger, format, transports } = require('winston');
const fs = require('fs');
const path = require('path');

var initialized = false;
var filelogger;
var logDir = '';

const env = process.env.NODE_ENV || 'development';

var log = module.exports = {

    init: function (logdir) {
        if (logdir) {
            logDir = logdir;
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
                    filename: `${logDir}/fuxa.log`,
                    maxsize:  5242880, // 5MB
                    maxFiles: 5,
                    json: false
                }),
                new (transports.File)({
                    level: 'error',
                    filename: `${logDir}/fuxa-err.log`,
                    maxsize: 5242880, // 5MB
                    maxFiles: 5,
                    json: false                  
                })
            ]
        });
        initialized = true;
    },

    debug: function (str, flag) {
        //	debug color: Cyan
        console.log("\x1B[36m"  + new Date().toISOString() + ' [DBG]  ' + "\t" + processInput(str) + "\x1B[39m");
        if (initialized && (null == flag || true === flag)) {
            filelogger.debug(str);
        }
    },
    info: function (str, flag) {
        //	debug color: Default (White / Black)
        if (initialized && (null == flag || false === flag)) {
            console.log(new Date().toISOString() + ' [INF] ' + "\t" + processInput(str));
        }
        if (initialized && (null == flag || true === flag)) {
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