//@ts-check
'use strict';

// @ts-ignore
const pkg = require('./package.json');
const path = require('path');
const os = require('os');
var fs = require('fs-extra');

/**
 * @param {string} platform
 * @returns {string}
 */
function getAppDataPath(platform) {
	switch (platform) {
		case 'win32': return process.env['FUXA_APPDATA'] || process.env['APPDATA'] || path.join(process.env['USERPROFILE'], 'AppData', 'Roaming');
		case 'darwin': return process.env['FUXA_APPDATA'] || path.join(os.homedir(), 'Library', 'Application Support');
		case 'linux': return process.env['FUXA_APPDATA'] || process.env['XDG_CONFIG_HOME'] || path.join(os.homedir(), '.config');
		default: throw new Error('Platform not supported');
	}
}

/**
 * @param {string} platform
 * @returns {string}
 */
function getDefaultUserDataPath(platform) {
	return path.join(getAppDataPath(platform), pkg.name);
}

/**
 * 
 * @param {*} dirPath 
 */
function ensureDirs(dirPath) {
  if (fs.existsSync(dirPath)) {
    return;
  }
  fs.mkdirSync(dirPath);
}

exports.getAppDataPath = getAppDataPath;
exports.getDefaultUserDataPath = getDefaultUserDataPath;
exports.ensureDirs = ensureDirs;