/**
 *  Module to manage the DAQ datastore with daqnode 
 */

'use strict';

const fs = require('fs');
const path = require('path');
var DaqNode = require("./daqnode");

var settings
var logger;
var daqnodes = {};              // list of daqnode

function init(_settings, _log) {
    settings = _settings;
    logger = _log;
    logger.info("daqstorage: init successful!", true);
}

function reset() {
    for (var id in daqnodes) {
        daqnodes[id].close();
    }
    daqnodes = {};
    logger.info("daqstorage reset!", true);
}

function addDaqNode(id, fncgetprop) {
    if (!daqnodes[id]) {
        daqnodes[id] = DaqNode.create(settings, logger, id);
    }
    return daqnodes[id].setCall(fncgetprop);
    // return daqnodes[id].addDaqValue;
}

function getNodeValues(tagid, fromts, tots) {
    return new Promise(function (resolve, reject) {
        var daqnode = _getDaqNode(tagid);
        if (daqnode) {
            resolve(daqnode.getDaqValue(tagid, fromts, tots));
        } else {
            reject();
        }
    });
}

function _getDaqNode(tagid) {
    var nodes = Object.values(daqnodes);
    for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].getDaqMap()[tagid]) {
            return nodes[i];
        }
    }
}

module.exports = {
    init: init,
    reset: reset,
    addDaqNode: addDaqNode,
    getNodeValues: getNodeValues
};