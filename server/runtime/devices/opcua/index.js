

const opcua = require('node-opcua');
const async = require('async');

// try {
//     var the_session;
//     const endpoint = 'opc.tcp://' + require('os').hostname() + ':48010';//':4861';
//     client.connect(endpoint, function (err) {
//         if (err) {
//             logger.error(err);
//         } else {
//             logger.debug("connected");
//             createSession();
//         }
//     })
//     // client.findServersOnNetwork(function (result) {
//     //     console.log(result);
//     // });
// } catch (err) {
//     console.log(err);
// }

// function createSession() {
//     client.createSession(function (err, session) {
//         if (err) {
//             logger.error(err);
//         } else {
//             the_session = session;
//             browserSession();
//         }
//     });
// }

// function browserSession() {
//     the_session.browse('RootFolder', function (err, browseResult) {
//         if (err) {
//             logger.error(err);
//         } else {
//             browseResult.references.forEach(function (reference) {
//                 console.log(reference.browseName.toString());
//             })
//         }
//     })
// }

// console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');

function OpcUAclient(_data, _logger, _events) {

    var data = _data;                   // Current Device data { id, name, tags, enabled, ... }
    var logger = _logger;               // Logger
    var working = false;                // Working flag to manage overloading polling and connection
    var connected = false;              // Connected flag
    var monitored = false;              // Monitored flag
    var lastStatus = '';                // Last Device status
    var events = _events;               // Events to commit change to runtime
    var the_session;
    var the_subscription = null;
    var options = { connectionStrategy: { maxRetry: 1 }, keepSessionAlive: true };  // Connections options
    var client = new opcua.OPCUAClient(options);
    const attributeKeys = Object.keys(opcua.AttributeIds).filter((x) => x === "DataType" || x === "AccessLevel" || x === "UserAccessLevel");//x !== "INVALID" && x[0].match(/[a-zA-Z]/));

    var varsValue = [];                 // Signale to send to frontend { id, type, value }
    var daqInterval = 0;
    var lastDaqInterval = 0;

    this.connect = function () {
        return new Promise(function (resolve, reject) {
            if (!_checkWorking(true)) {
                reject();
            } else {
                async.series([
                    // step 1 connect
                    function (callback) {
                        const endpoint = data.property.address;//'opc.tcp://' + require('os').hostname() + ':48010';
                        client.connect(endpoint, function (err) {
                            if (err) {
                                _clearVarsValue();
                                logger.error(err);
                            } else {
                                logger.info(data.name + ': connection step 1');
                            }
                            callback(err);
                        })
                    },
                    // step 2 create session
                    function (callback) {
                        client.createSession(function (err, session) {
                            if (err) {
                                _clearVarsValue();
                                logger.error(err);
                            } else {
                                the_session = session;
                                the_session.on("session_closed", () => {
                                    logger.info(data.name + ': Warning => Session closed');
                                });
                                the_session.on("keepalive", () => {
                                    logger.info(data.name + ': session keepalive');
                                });
                                the_session.on("keepalive_failure", () => {
                                    logger.error(data.name + ': session keepalive failure');
                                });
                                _createSubscription();
                            }
                            callback(err);
                        });
                    }],
                    function (err) {
                        if (err) {
                            logger.error(data.name + ': try to connect error! ' + err);
                            _emitStatus('connect-error');
                            _clearVarsValue();
                            connected = false;
                            reject();
                            client.disconnect(function () { });
                        } else {
                            logger.info(data.name + ': connected!');
                            _emitStatus('connect-ok');
                            connected = true;
                            resolve();
                        }
                        _checkWorking(false);
                    });
            }
        });
    }

    this.disconnect = function () {
        _disconnect(function (err) {
            if (err) {
                logger.error(data.name + ': disconnect failure, ' + err);
            }
            connected = false;
            monitored = false;
            _checkWorking(false);
            _emitStatus('connect-off');
            _clearVarsValue();
        });
    }

    this.browse = function (node) {
        let nodeId = (node) ? node.id : opcua.resolveNodeId("RootFolder");
        return new Promise(function (resolve, reject) {
            // "RootFolder"
            if (the_session) {
                const b = [{
                    nodeId: nodeId,
                    referenceTypeId: "Organizes",
                    includeSubtypes: true,
                    browseDirection: opcua.BrowseDirection.Forward,
                    resultMask: 0x3f

                },
                {
                    nodeId: nodeId,
                    referenceTypeId: "Aggregates",
                    includeSubtypes: true,
                    browseDirection: opcua.BrowseDirection.Forward,
                    resultMask: 0x3f

                },
                {
                    nodeId: nodeId,
                    referenceTypeId: "HasSubtype",
                    includeSubtypes: true,
                    browseDirection: opcua.BrowseDirection.Forward,
                    resultMask: 0x3f
                }];

                the_session.browse(nodeId, function (err, browseResult) {
                    if (!err) {
                        let opcNodes = [];
                        browseResult.references.forEach(function (reference) {
                            console.log(reference.browseName.toString());
                            let node = new OpcNode(reference.browseName.toString());
                            if (reference.displayName) {
                                node.name = reference.displayName.text;
                            }
                            node.id = reference.nodeId;
                            node.class = reference.nodeClass;
                            opcNodes.push(node);
                        });

                        if (browseResult.continuationPoint) {
                            var nextresult = _browseNext(browseResult.continuationPoint).then(nodes => {
                                for (let i = 0; i < nodes.length; i++) {
                                    opcNodes.push(nodes[i]);
                                }
                                resolve(opcNodes);
                            });
                        } else {
                            resolve(opcNodes);
                        }
                    } else {
                        reject(err);
                    }
                });
            } else {
                reject('Session Error');
            }
        });
    }

    var _browseNext = function (contipoint) {
        var opcNodes = [];
        var browseNextRequest = new opcua.browse_service.BrowseNextRequest({
            continuationPoints: [contipoint]
        });
        return new Promise(function (resolve, reject) {
            the_session.performMessageTransaction(browseNextRequest, function (err, response) {
                if (err) {
                    reject(err);
                } else {
                    if (response.results && response.results[0]) {
                        let browseResult = response.results[0];
                        browseResult.references.forEach(function (reference) {
                            // console.log(reference.browseName.toString());
                            let node = new OpcNode(reference.browseName.toString());
                            if (reference.displayName) {
                                node.name = reference.displayName.text;
                            }
                            node.id = reference.nodeId;
                            node.class = reference.nodeClass;
                            opcNodes.push(node);
                        });
                        if (browseResult.continuationPoint) {
                            _browseNext(browseResult.continuationPoint).then(nodes => {
                                for (let i = 0; i < nodes.length; i++) {
                                    opcNodes.push(nodes[i]);
                                }
                                return resolve(opcNodes);
                            });
                        } else {
                            return resolve(opcNodes);
                        }
                    } else {
                        return resolve(opcNodes);
                    }
                }
            });
        });
    }

    // var readNodesAttributefnc = [];
    // readNodesAttributefnc.push(_readAttribute(node));
    // Promise.all(readNodesAttributefnc).then(result => {
    // }, reason => {
    //     if (reason.stack) {
    //     } else {
    //     }
    // });                        


    this.readAttribute = function (node) {

        const attr = [];

        const nodesToRead = attributeKeys.map((attr) => ({
            nodeId: node.id,
            attributeId: opcua.AttributeIds[attr]
        }));

        return new Promise(function (resolve, reject) {

            the_session.read(nodesToRead, function (err, dataValues) {
                if (err) {
                    reject("#readAllAttributes returned " + err.message);
                } else {
                    node.attribute = {};
                    for (let i = 0; i < nodesToRead.length; i++) {
                        const obj = _attrToObject(nodesToRead[i].attributeId, dataValues[i]);
                        if (obj) {
                            node.attribute[nodesToRead[i].attributeId] = obj.attribute;
                        }
                        // if (dataValue.statusCode !== opcua.StatusCodes.Good) {
                        //     continue;
                        // }
                        // const s = toString1(nodeToRead.attributeId, dataValue);
                        // append_text(attributeIdtoString[nodeToRead.attributeId], s, attr);
                    }
                    resolve(node);
                }
            });
        });
    }

    this.polling = function () {
        if (!monitored) {
            _startMonitor(function (ok) {
                if (ok) {
                    monitored = true;
                }
            });
        } else if (the_session && client) {
            var varsValueChanged = _clearVarsChanged();
            // if (Object.keys(varsValueChanged).length) {
            //     _emitValues(varsValueChanged);
            // }
            _emitValues(varsValue);

            if (this.addDaq) {
                var current = new Date().getTime();
                if (current - daqInterval > lastDaqInterval) {
                    this.addDaq(data.tags);
                    lastDaqInterval = current;
                } else if (Object.keys(varsValueChanged).length) {
                    this.addDaq(varsValueChanged);
                }
                // for (var dbid in dbvalues) {
                //     addDaq(dbid, dbvalues[dbid].value);
                // }
            }

        }
    }

    this.load = function (_data) {
        data = JSON.parse(JSON.stringify(_data));
        // db = {};
        // varsValue = [];
        // varsItemsMap = {};
        var count = Object.keys(data.tags).length;
        logger.info(data.name + ' data loaded (' + count + ')');
    }

    this.getValues = function () {
        return data.tags;
    }

    this.getStatus = function () {
        return lastStatus;
    }

    this.getTagProperty = function (id) {
        if (data.tags[id]) {
            let prop = { id: id, name: data.tags[id].name, type: data.tags[id].type };
            return prop;
        } else {
            return null;
        }
    }

    this.setValue = function (sigid, value) {
        if (the_session && data.tags[sigid]) {
            console.log(sigid);
            let opctype = _toDataType(data.tags[sigid].type);
            let valtosend = _toValue(opctype, value);
            var nodesToWrite = [
                {
                    nodeId: sigid,
                    attributeId: opcua.AttributeIds.Value,
                    value: /*new DataValue(*/{
                        value: {/* Variant */
                            dataType: opctype,
                            value: valtosend
                        }
                    }
                }
            ];

            the_session.write(nodesToWrite, function (err, statusCodes) {
                if (err) {
                    logger.error(data.name + ' setValue error: ' + err);
                }
            });

        }
    }

    this.isConnected = function () {
        return connected;
    }

    this.bindAddDaq = function (fnc, intervalToSave) {
        this.addDaq = fnc;                         // Add the DAQ value to db history
        daqInterval = intervalToSave;
    }

    this.addDaq = null;                         // Add the DAQ value to db history

    var _disconnect = function (callback) {
        if (!the_session) {
            client.disconnect(function (err) {
                callback(err);
            });
        } else {
            the_session.close(function () {
                client.disconnect(function (err) {
                    callback(err);
                });
            });
        }
    }

    var _createSubscription = function () {
        if (the_session) {
            const parameters = {
                requestedPublishingInterval: 500,
                requestedLifetimeCount: 1000,
                requestedMaxKeepAliveCount: 12,
                maxNotificationsPerPublish: 100,
                publishingEnabled: true,
                priority: 10
            };
            the_session.createSubscription2(
                parameters,
                (err, subscription) => {
                    if (err) {
                        logger.error(data.name + ': Cannot create subscription ' + err.message);
                        return;
                    }
                    the_subscription = subscription;
                    logger.info(data.name + ': subscription created!');
                });
        }
    }

    var _startMonitor = function (callback) {

        if (the_session && the_subscription) {
            for (var id in data.tags) {
                var nodeId = id;
                var monitoredItem = the_subscription.monitor(
                    { nodeId: nodeId, attributeId: opcua.AttributeIds.Value },
                    { samplingInterval: 1000, discardOldest: true, queueSize: 1 },
                    opcua.read_service.TimestampsToReturn.Both,
                );
                monitoredItem.on("changed", _monitorcallback(nodeId));
                // monitoredItem.on("changed", function (dataValue) {

                //     console.log(" value ", node.browseName, node.nodeId.toString(), " changed to ", chalk.green(dataValue.value.toString()));
                //     if (dataValue.value.value.toFixed) {
                //         node.valueAsString = w(dataValue.value.value.toFixed(3), 16);
                //     } else {
                //         node.valueAsString = w(dataValue.value.value.toString(), 16);
                //     }

                //     monitoredItemData[2] = node.valueAsString;
                //     monitoredItemsList.setRows(monitoredItemsListData);
                //     monitoredItemsList.render();
                // });

            }
            callback(true);
        } else {
            callback(false);
        }
    }

    var _monitorcallback = function (_nodeId) {
        var nodeId = _nodeId;
        return function (dataValue) {
            console.log(nodeId.toString(), "\t value : ", dataValue.value.value.toString());
            if (data.tags[nodeId]) {
                data.tags[nodeId].value = dataValue.value.value;//.toString();
                data.tags[nodeId].timestamp = dataValue.serverTimestamp.toString();
                data.tags[nodeId].changed = true;
            }
        };
    }

    var _clearVarsValue = function () {
        for (let id in varsValue) {
            varsValue[id].value = null;
        }
        _emitValues(varsValue);
    }

    var _clearVarsChanged = function () {
        var result = {};
        for (var id in data.tags) {
            if (data.tags[id].changed) {
                data.tags[id].changed = false;
                result[id] = data.tags[id];
            }
            varsValue[id] = data.tags[id];
        }
        return result;
    }

    var _checkWorking = function (check) {
        if (check && working) {
            logger.error(data.name + ' working (connection || polling) overload!');
            return false;
        }
        working = check;
        return true;
    }

    var _emitValues = function (values) {
        events.emit('device-value:changed', { id: data.name, values: values });
    }

    var _emitStatus = function (status) {
        lastStatus = status;
        events.emit('device-status:changed', { id: data.name, status: status });
    }

    var _attrToObject = function (attribute, dataValue) {

        if (!dataValue || !dataValue.value || !dataValue.value.hasOwnProperty("value")) {
            return null;
        }
        switch (attribute) {
            case opcua.AttributeIds.DataType:
                let dtype = opcua.DataType[dataValue.value.value.value];
                return { attribute: dtype };
            // case opcua.AttributeIds.NodeClass:
            //     return NodeClass[dataValue.value.value] + " (" + dataValue.value.value + ")";
            // case opcua.AttributeIds.IsAbstract:
            // case opcua.AttributeIds.Historizing:
            // case opcua.AttributeIds.EventNotifier:
            //     return dataValue.value.value ? "true" : "false"
            // case opcua.AttributeIds.WriteMask:
            // case opcua.AttributeIds.UserWriteMask:
            //     return " (" + dataValue.value.value + ")";
            // case opcua.AttributeIds.NodeId:
            // case opcua.AttributeIds.BrowseName:
            // case opcua.AttributeIds.DisplayName:
            // case opcua.AttributeIds.Description:
            // case opcua.AttributeIds.ValueRank:
            // case opcua.AttributeIds.ArrayDimensions:
            // case opcua.AttributeIds.Executable:
            // case opcua.AttributeIds.UserExecutable:
            // case opcua.AttributeIds.MinimumSamplingInterval:
            //     if (!dataValue.value.value) {
            //         return "null";
            //     }
            //     return dataValue.value.value.toString();
            case opcua.AttributeIds.UserAccessLevel:
            case opcua.AttributeIds.AccessLevel:
                if (!dataValue.value.value) {
                    return null;
                }
                let rlev = opcua.AccessLevelFlag[dataValue.value.value & 1];
                let wlev = opcua.AccessLevelFlag[dataValue.value.value & 2];
                let lev = '';
                if (rlev) {
                    lev += 'R';
                }
                if (wlev) {
                    if (rlev) {
                        lev += '/';
                    }
                    lev += 'W';
                }
                return { attribute: lev };
            default:
                return null;
        }
    }

    var _toDataType = function (type) {
        if (type === 'Boolean') {
            return opcua.DataType.Boolean;
        } else if (type === 'SByte') {
            return opcua.DataType.SByte;
        } else if (type === 'Byte') {
            return opcua.DataType.Byte;
        } else if (type === 'Int16') {
            return opcua.DataType.Int16;
        } else if (type === 'UInt16') {
            return opcua.DataType.UInt16;
        } else if (type === 'Int32') {
            return opcua.DataType.Int32;
        } else if (type === 'UInt32') {
            return opcua.DataType.UInt32;
        } else if (type === 'Int64') {
            return opcua.DataType.Int64;
        } else if (type === 'UInt64') {
            return opcua.DataType.UInt64;
        } else if (type === 'Float') {
            return opcua.DataType.Float;
        } else if (type === 'Double') {
            return opcua.DataType.Double;
        } else if (type === 'String') {
            return opcua.DataType.String;
        } else if (type === 'DateTime') {
            return opcua.DataType.DateTime;
        } else if (type === 'Guid') {
            return opcua.DataType.Guid;
        } else if (type === 'ByteString') {
            return opcua.DataType.ByteString;
        }
    }

    var _toValue = function (type, value) {
        switch (type) {
            case opcua.DataType.Boolean:
                return value;
            case opcua.DataType.SByte:
            case opcua.DataType.Byte:
            case opcua.DataType.Int16:
            case opcua.DataType.UInt16:
            case opcua.DataType.Int32:
            case opcua.DataType.UInt3:
            case opcua.DataType.Int64:
            case opcua.DataType.UInt64:
                return parseInt(value);
            case opcua.DataType.Float:
            case opcua.DataType.Double:
                return parseFloat(value);
            default:
                return value;
        }
    }
}

function start() {
    // start polling timer
}

function stop() {
    // stop polling timer
}

module.exports = {
    init: function (settings) {
        // deviceCloseTimeout = settings.deviceCloseTimeout || 15000;
    },
    create: function (data, logger, events) {
        return new OpcUAclient(data, logger, events);
    }
}

function OpcNode(name) {
    this.name = name;
    this.id = '';
    this.class = '';
    this.type = '';
    this.value = '';
    this.timestamp = '';
    this.attribute;
}