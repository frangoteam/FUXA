
var events = require("events");

/**
 * @enum
 */
const IoEventTypes = {
    DEVICE_STATUS: 'device-status',
    DEVICE_PROPERTY: 'device-property',
    DEVICE_VALUES: 'device-values',
    DEVICE_BROWSE: 'device-browse',
    DEVICE_NODE_ATTRIBUTE: 'device-node-attribute',
    DEVICE_WEBAPI_REQUEST: 'device-webapi-request',
    DEVICE_TAGS_REQUEST: 'device-tags-request',
    DEVICE_TAGS_SUBSCRIBE: 'device-tags-subscribe',
    DEVICE_TAGS_UNSUBSCRIBE: 'device-tags-unsubscribe',
    DEVICE_ENABLE: 'device-enable',
    DAQ_QUERY: 'daq-query',
    DAQ_RESULT: 'daq-result',
    DAQ_ERROR: 'daq-error',
    ALARMS_STATUS: 'alarms-status',
    HOST_INTERFACES: 'host-interfaces',
    SCRIPT_CONSOLE: 'script-console',
}

// module.exports = IoEventTypes;

module.exports = {
    create: function () {
        return new events.EventEmitter();
    },
    IoEventTypes: IoEventTypes
}