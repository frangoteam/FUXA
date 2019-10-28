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

    logger.info("daqstorage init successful!");

    //! to test
    // setTimeout(function () {
    //     var fromts = new Date(2019, 7, 19, 8, 0, 0).getTime();
    //     var tots = new Date(2019, 7, 19, 16, 1, 0).getTime();
    //     for (var nodeid in daqnodes) {
    //         var map = daqnodes[nodeid].getDaqMap();
    //         for (var id in map) {
    //             daqnodes[nodeid].getDaqValue(id, fromts, tots).then(result => {
    //                 console.log(result);

    //             }).catch(function (err) {
    //                 console.err('getDaqValue _getTagValues error: ' + err);
    //             });
    //         }
    //     }

    // }, 5000);
    
    return true;
}

function reset() {
    for (var id in daqnodes) {
        daqnodes[id].close();
    }
    daqnodes = {};
    logger.info("daqstorage reset!");
}

function addDaqNode(id, fncgetprop) {
    if (!daqnodes[id]) {
        daqnodes[id] = DaqNode.create(settings, logger, id);
    }
    return daqnodes[id].setCall(fncgetprop);
    // return daqnodes[id].addDaqValue;
}

function getNodeValues(nodeid, tagid, fromts, tots) {
    return new Promise(function (resolve, reject) {
        if (daqnodes[nodeid]) {
            resolve(daqnodes[nodeid].getDaqValue(tagid, fromts, tots));
        } else {
            reject();
        }
    });
}

module.exports = {
    init: init,
    reset: reset,
    addDaqNode: addDaqNode,
    getNodeValues: getNodeValues
};