/*
* Project manager: read, write, add, remove, ... and save 
*/

'use strict';

const fs = require('fs');
const path = require('path');

var events = require("../events");

const version = "1.00";
var settings;
var project;
var projectdata;
var projectFile;
var logger;

function init(_settings, log) {
    settings = _settings;
    logger = log;
    // Read project settings 
    var prjfiles = getProjectFile();
    projectFile = path.join(settings.workDir, "project.fuxap");
    if (!prjfiles || prjfiles.length <= 0) {
        logger.info("project not found!");
        var defaultProject = path.join(settings.appDir, "project.default.json");
        // Default settings file has not been modified - safe to copy
        fs.copyFileSync(defaultProject, projectFile)
        logger.info("project.fuxap default created successful!");
        return updateProject();
    } else {
        projectFile = path.join(settings.workDir, prjfiles[0]);
        var result = updateProject();
        if (result) {
            logger.info("project: " + path.basename(projectFile) + " load successful!");
        }
        return result;
    }
}

function getProjectFile() {
    var filesList = fs.readdirSync(settings.workDir);
    filesList = filesList.filter(function (file) {
        return path.extname(file).toLowerCase() === '.fuxap' && path.basename(file).toLowerCase().startsWith('project');
    });
    return filesList;
}

function setProjectFile(prjcontent) {
    return new Promise(function (resolve, reject) {
        try {
            fs.writeFile(projectFile, JSON.stringify(prjcontent), function (err, content) {
                if (err) reject(err);
                logger.info('project.write-successfull');
                resolve(true);
            });
        } catch (err) {
            reject();
        }
    });
}

function getDevices() {
    if (projectdata) {
        return projectdata.devices;
    }
    return null;
}

function getProject() {
    return projectdata;
}

function updateProject() {
    var prjfiles = getProjectFile();
    if (prjfiles) {
        var tempfile = path.join(settings.workDir, prjfiles[0]);
        projectdata = JSON.parse(fs.readFileSync(tempfile, 'utf8'));
        return true;
    }
    return false;
}

function getProjectDemo() {
    var demoProject = path.join(settings.appDir, "project.demo.fuxap");
    return JSON.parse(fs.readFileSync(demoProject, 'utf8'));;
} 

module.exports = {
    init: init,
    getDevices: getDevices,
    updateProject: updateProject,
    getProject: getProject,
    setProjectFile: setProjectFile,
    getProjectDemo: getProjectDemo,
};
