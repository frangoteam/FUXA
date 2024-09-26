/**
 * OPC UA Client Driver
 */
var opcua;

const async = require('async');
const utils = require('../../utils');
const deviceUtils = require('../device-utils');

function OpcUAclient(_data, _logger, _events, _runtime) {

    var runtime = _runtime;
    var data = _data;                   // Current Device data { id, name, tags, enabled, ... }
    var logger = _logger;               // Logger
    var working = false;                // Working flag to manage overloading polling and connection
    var connected = false;              // Connected flag
    var monitored = false;              // Monitored flag
    var lastStatus = '';                // Last Device status
    var events = _events;               // Events to commit change to runtime
    var the_session;
    var the_subscription = null;
    var options = { connectionStrategy: { maxRetry: 1 }, keepSessionAlive: true, endpointMustExist: false };  // Connections options
    var client = opcua.OPCUAClient.create(options);
    const attributeKeys = Object.keys(opcua.AttributeIds).filter((x) => x === 'DataType' || x === 'AccessLevel' || x === 'UserAccessLevel');//x !== "INVALID" && x[0].match(/[a-zA-Z]/));

    var varsValue = [];                 // Signale to send to frontend { id, type, value }
    var getProperty = null;             // Function to ask property (security)
    var lastTimestampValue;             // Last Timestamp of asked values
    var tagsIdMap = {};                 // Map of tag id with opc nodeId
    /**
     * Connect the client to OPC UA server
     * Open Session, Create Subscription, Emit connection status, Clear the memory Tags value
     */
    this.connect = function () {
        var self = this;
        return new Promise(function (resolve, reject) {
            if (!_checkWorking(true)) {
                reject();
            } else {
                var property = null;
                async.series([
                    // step 1 check property
                    function (callback) {
                        if (getProperty) {
                            getProperty({query: 'security', name: data.id}).then(result => {
                                if (result && result.value && result.value !== 'null') {
                                    // property security mode
                                    property = JSON.parse(result.value);
                                    var opts = {
                                        // applicationName: 'Myclient',
                                        endpointMustExist: false,
                                        keepSessionAlive: true,
                                        connectionStrategy: { maxRetry: 1 } };
                                    if (property.mode) {
                                        if (property.mode.securityMode) {
                                            opts['securityMode'] = property.mode.securityMode;
                                        }
                                        if (property.mode.securityPolicy) {
                                            opts['securityPolicy'] = property.mode.securityPolicy;
                                        }
                                    }
                                    client = opcua.OPCUAClient.create(opts);
                                }
                                callback();
                            }).catch(function (err) {
                                callback(err);
                            });
                        } else {
                            callback();
                        }
                    },
                    // step 2 connect
                    function (callback) {
                        const endpoint = data.property.address;
                        client.connect(endpoint, function (err) {
                            if (err) {
                                _clearVarsValue();
                                logger.error(`'${data.name}' connect failure! ${err}`);
                            } else {
                                logger.info(`'${data.name}' connection`, true);
                            }
                            callback(err);
                        });
                        client.on("connection_lost", () => {
                            logger.error(`'${data.name}' connection lost!`);
                            self.disconnect().then(function () { });
                        });
                        client.on("backoff", (retry, delay) => {
                            logger.error(`'${data.name}' retry to connect! ${retry}`);
                        });
                    },
                    // step 3 create session
                    function (callback) {
                        const userIdentityInfo = { };
                        if (property && property.uid && property.pwd) {
                            userIdentityInfo['userName'] = property.uid;
                            userIdentityInfo['password'] = property.pwd;
                        }
                        client.createSession(userIdentityInfo, function (err, session) {
                            if (err) {
                                _clearVarsValue();
                                logger.error(`'${data.name}' createSession failure! ${err}`);
                            } else {
                                the_session = session;
                                the_session.on('session_closed', () => {
                                    logger.warn(`'${data.name}' Warning => Session closed`);
                                });
                                the_session.on('keepalive', () => {
                                    logger.info(`'${data.name}' session keepalive`, true);
                                });
                                the_session.on('keepalive_failure', () => {
                                    logger.error(`'${data.name}' session keepalive failure!`);
                                });
                                the_session.on("terminated", function() {
                                    console.log("terminated");
                                });
                                _createSubscription();
                            }
                            callback(err);
                        });
                    }],
                    function (err) {
                        if (err) {
                            logger.error(`'${data.name}' try to connect error! ${err}`);
                            _emitStatus('connect-error');
                            _clearVarsValue();
                            connected = false;
                            reject();
                            client.disconnect(function () { });
                        } else {
                            logger.info(`'${data.name}' connected!`, true);
                            _emitStatus('connect-ok');
                            connected = true;
                            resolve();
                        }
                        _checkWorking(false);
                    });
            }
        });
    }

    /**
     * Disconnect the OPC UA server
     * Emit connection status, Clear the memory Tags value
     */
    this.disconnect = function () {
        return new Promise(function (resolve, reject) {
            _disconnect(function (err) {
                if (err) {
                    logger.error(`'${data.name}' disconnect failure! ${err}`);
                }
                connected = false;
                monitored = false;
                _checkWorking(false);
                _emitStatus('connect-off');
                _clearVarsValue();
                resolve(true);
            });
        });
    }

    /**
     * Browse Server Nodes, read the childres of gived node
     * The browser callback have a children nodes count limit and have to use _browseNext
     */
    this.browse = function (node) {
        let nodeId = (node) ? node.id : opcua.resolveNodeId('RootFolder');
        return new Promise(function (resolve, reject) {
            // "RootFolder"
            if (the_session) {
                the_session.browse(nodeId, function (err, browseResult) {
                    if (!err) {
                        let opcNodes = [];
                        browseResult.references.forEach(function (reference) {
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

    /**
     * Browser the next children nodes after contipoint position
     * @param {*} contipoint
     */
    var _browseNext = function (contipoint) {
        var opcNodes = [];
        var browseNextRequest = new opcua.BrowseNextRequest({
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

    /**
     * Read node attribute
     */
    this.readAttribute = function (node) {

        const attr = [];

        const nodesToRead = attributeKeys.map((attr) => ({
            nodeId: node.id,
            attributeId: opcua.AttributeIds[attr]
        }));

        return new Promise(function (resolve, reject) {

            the_session.read(nodesToRead, function (err, dataValues) {
                if (err) {
                    reject('#readAllAttributes returned ' + err.message);
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

    /**
     * Take the current Tags value (only changed), Reset the change flag, Emit Tags value
     * Save DAQ value
     */
    this.polling = async function () {
        if (_checkWorking(true)) {
            if (!monitored) {
                _startMonitor().then(ok => {
                    if (ok && connected) {
                        monitored = true;
                    }
                    _checkWorking(false);
                }).catch(function (err) {
                    logger.error(`'${data.name}' polling error (_startMonitor): ${err}`);
                    _checkWorking(false);
                });
            } else if (the_session && client) {
                try {
                    var varsValueChanged = await _checkVarsChanged();
                    lastTimestampValue = new Date().getTime();
                    _emitValues(varsValue);

                    if (this.addDaq && !utils.isEmptyObject(varsValueChanged)) {
                        this.addDaq(varsValueChanged, data.name, data.id);
                    }
                } catch (err) {
                    logger.error(`'${data.name}' polling error: ${err}`);
                }
                _checkWorking(false);
            } else {
                _checkWorking(false);
            }
        }
    }

    /**
     * Load Tags to read by polling
     */
    this.load = function (_data) {
        data = JSON.parse(JSON.stringify(_data));
        try {
            var count = Object.keys(data.tags).length;
            logger.info(`'${data.name}' data loaded (${count})`, true);
        } catch (err) {
            logger.error(`'${data.name}' load error! ${err}`);
        }
    }

    /**
     * Return Tags values array { id: <name>, value: <value>, type: <type> }
     */
    this.getValues = function () {
        return data.tags;
    }

    /**
     * Return Tag value { id: <name>, value: <value>, ts: <lastTimestampValue> }
     */
    this.getValue = function (id) {
        if (varsValue[id]) {
            return {id: id, value: varsValue[id].value, ts: lastTimestampValue };
        }
        return null;
    }

    /**
     * Return Device status Connected/Disconnected 'connect-off', 'connect-ok', 'connect-error'
     */
    this.getStatus = function () {
        return lastStatus;
    }

    /**
     * Return Tag property
     */
    this.getTagProperty = function (id) {
        if (data.tags[id]) {
            return { id: id, name: data.tags[id].name, type: data.tags[id].type, format: data.tags[id].format };
        } else {
            return null;
        }
    }

    /**
     * Set Tag value, used to set value from frontend
     */
    this.setValue = async function (tagId, value) {
        if (the_session && data.tags[tagId]) {
            let opctype = _toDataType(data.tags[tagId].type);
            let valueToSend = _toValue(opctype, value);
            valueToSend = await deviceUtils.tagRawCalculator(valueToSend, data.tags[tagId], runtime);
            var nodesToWrite = [
                {
                    nodeId: data.tags[tagId].address,
                    attributeId: opcua.AttributeIds.Value,
                    value: /*new DataValue(*/{
                        value: {/* Variant */
                            dataType: opctype,
                            value: valueToSend
                        }
                    }
                }
            ];

            the_session.write(nodesToWrite, function (err, statusCodes) {
                if (err) {
                    logger.error(`'${data.name}' setValue error! ${err}`);
                } else {
                    logger.info(`'${data.name}' setValue(${tagId}, ${value})`, true, true);
                }
            });
            return true;
        }
        return false;
    }

    /**
     * Is Connected true/false
     */
    this.isConnected = function () {
        return connected;
    }

    /**
     * Set the callback to set value to DAQ
     */
    this.bindAddDaq = function (fnc) {
        this.addDaq = fnc;                          // Add the DAQ value to db history
    }
    this.addDaq = null;                             // Callback to add the DAQ value to db history


    /**
     * Return the timestamp of last read tag operation on polling
     * @returns
     */
     this.lastReadTimestamp = () => {
        return lastTimestampValue;
    }

    /**
     * Set function to ask property (security)
     */
    this.bindGetProperty = function (fnc) {
        getProperty = fnc;
    }

    /**
     * Return the Daq settings of Tag
     * @returns
     */
    this.getTagDaqSettings = (tagId) => {
        return data.tags[tagId] ? data.tags[tagId].daq : null;
    }

    /**
     * Set Daq settings of Tag
     * @returns
     */
    this.setTagDaqSettings = (tagId, settings) => {
        if (data.tags[tagId]) {
            utils.mergeObjectsValues(data.tags[tagId].daq, settings);
        }
    }

    /**
     * Disconnect the OPC UA client and close session if used
     * @param {*} callback
     */
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

    /**
     * Create a session subscription to refresh Tags value
     */
    var _createSubscription = function () {
        if (the_session) {
            const parameters = {
                requestedPublishingInterval: 500,
                requestedLifetimeCount: 600,
                requestedMaxKeepAliveCount: 10,
                maxNotificationsPerPublish: 0,
                publishingEnabled: true,
                priority: 0
            };
            the_session.createSubscription2(
                parameters,
                (err, subscription) => {
                    if (err) {
                        logger.error(`'${data.name}' can't create subscription! ${err.message}`);
                        return;
                    }
                    the_subscription = subscription;
                    logger.info(`'${data.name}' subscription created!`, true);
                });
        }
    }

    /**
     * Start the monitor by subsribe the Tags to check if value change
     * samplingInterval = 1000 msec.
     * @param {*} callback
     */
    var _startMonitor = function () {
        return new Promise(async function (resolve, reject) {
            if (the_session && the_subscription) {
                tagsIdMap = {};
                var count = 0;
                for (var id in data.tags) {
                    count++;
                    try {
                        var nodeId = data.tags[id].address;
                        tagsIdMap[nodeId] = id;
                        var monitoredItem = await the_subscription.monitor(
                            { nodeId: nodeId, attributeId: opcua.AttributeIds.Value },
                            { samplingInterval: data.polling || 1000, discardOldest: true, queueSize: 1 },
                            opcua.TimestampsToReturn.Both
                        );
                        monitoredItem.on('changed', _monitorcallback(nodeId));
                    } catch (err) {
                        logger.error(`'${nodeId}' _startMonitor ${err}`);
                    }
                }
                resolve(true);
            } else {
                reject();
            }
        });
    }

    /**
     * Callback from monitor of changed Tag value
     * And set the changed value to local Tags
     * @param {*} _nodeId
     */
    var _monitorcallback = function (_nodeId) {
        var nodeId = _nodeId;
        return function (dataValue) {
            if (dataValue && dataValue.value) {
                // console.log(nodeId.toString(), '\t value : ', dataValue.value.value.toString());
                let id = tagsIdMap[nodeId];
                if (data.tags[id]) {
                    data.tags[id].rawValue = dataValue.value.value;
                    data.tags[id].serverTimestamp = dataValue.serverTimestamp.toString();
                    data.tags[id].timestamp = new Date().getTime();
                    data.tags[id].changed = true;
                }
            }
        };
    }

    /**
     * Clear local Tags value by set all to null
     */
    var _clearVarsValue = function () {
        for (let id in varsValue) {
            varsValue[id].value = null;
        }
        _emitValues(varsValue);
    }

    /**
     * Return the Tags that have value changed and clear value changed flag of all Tags
     */
    var _checkVarsChanged = async () => {
        const timestamp = new Date().getTime();
        var result = {};
        for (var id in data.tags) {
            data.tags[id].value = await deviceUtils.tagValueCompose(data.tags[id].rawValue, varsValue[id] ? varsValue[id].value : null, data.tags[id], runtime);
            if (this.addDaq && !utils.isNullOrUndefined(data.tags[id].value) && deviceUtils.tagDaqToSave(data.tags[id], timestamp)) {
                result[id] = data.tags[id];
            }
            data.tags[id].changed = false;
            varsValue[id] = data.tags[id];
        }
        return result;
    }

    /**
     * To manage a overloading connection
     * @param {*} check
     */
    var _checkWorking = function (check) {
        if (check && working) {
            if (monitored) {
                logger.warn(`'${data.name}' working (connection || polling) overload!`);
            }
            return false;
        }
        working = check;
        return true;
    }

    /**
     * Emit Tags in application
     * @param {*} values
     */
    var _emitValues = function (values) {
        events.emit('device-value:changed', { id: data.id, values: values });
    }

    /**
     * Emit status in application
     * @param {*} status
     */
    var _emitStatus = function (status) {
        lastStatus = status;
        events.emit('device-status:changed', { id: data.id, status: status });
    }

    /**
     * Return formatted Tag attribute
     * @param {*} attribute
     * @param {*} dataValue
     */
    var _attrToObject = function (attribute, dataValue) {

        if (!dataValue || !dataValue.value || !dataValue.value.hasOwnProperty('value')) {
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

    /**
     * Convert OPCUA data type from string
     * @param {*} type
     */
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

    /**
     * Convert value from string depending of type
     * @param {*} type
     * @param {*} value
     */
    var _toValue = function (type, value) {
        switch (type) {
            case opcua.DataType.Boolean:
                if (typeof value === 'string' && (value.toLowerCase() === 'true' || value === '1')) {
                    return true;
                }
                return false;
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

/**
 * Return security and encryption mode supported from server endpoint
 */
function getEndPoints(endpointUrl) {
    return new Promise(function (resolve, reject) {
        if (loadOpcUALib()) {
            let opts = { connectionStrategy: { maxRetry: 1 } };
            let client = opcua.OPCUAClient.create(opts);
            try {
                client.connect(endpointUrl, function (err) {
                    if (err) {
                        reject('getendpoints-connect-error: ' + err.message);
                    } else {
                        const endpoints = client.getEndpoints().then(endpoints => {
                            const reducedEndpoints = endpoints.map(endpoint => ({
                                endpointUrl: endpoint.endpointUrl,
                                securityMode: endpoint.securityMode.toString(),
                                securityPolicy: endpoint.securityPolicyUri.toString(),
                            }));
                            resolve( reducedEndpoints);
                            client.disconnect();
                        }, reason => {
                            reject('getendpoints-error: ' + reason);
                            client.disconnect();
                        });
                    }
                });
            } catch (err) {
                reject('getendpoints-error: ' + err);
            }
        } else {
            reject('getendpoints-error: node-opcua not found!');
        }
    });
}

function loadOpcUALib() {
    if (!opcua) {
        try { opcua = require('node-opcua'); } catch { }
        if (!opcua && manager) { try { opcua = manager.require('node-opcua'); } catch { } }
    }
    return (opcua) ? true : false;
}

module.exports = {
    init: function (settings) {
        // deviceCloseTimeout = settings.deviceCloseTimeout || 15000;
    },
    create: function (data, logger, events, manager, runtime) {
        if (!loadOpcUALib()) return null;
        return new OpcUAclient(data, logger, events, runtime);
    },
    getEndPoints: getEndPoints
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
