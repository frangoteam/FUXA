module.exports = function(RED) {
    function hasTimestamp(value) {
        return value !== undefined && value !== null &&
            !(typeof value === 'string' && value.trim() === '');
    }

    function timestamp(messageValue, configuredValue, fallback, name) {
        var value = hasTimestamp(messageValue) ? messageValue :
            (hasTimestamp(configuredValue) ? configuredValue : fallback);
        if (typeof value === 'string') {
            value = value.trim();
            // Match get-daq: numeric strings are milliseconds, not calendar dates.
            value = /^-?\d+(?:\.\d+)?$/.test(value) ? Number(value) : Date.parse(value);
        }
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            throw new Error('Invalid ' + name + ' timestamp: use milliseconds or a valid date string');
        }
        return value;
    }

    function FuxaGetHistoryAlarmsNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var fuxa = RED.settings.functionGlobalContext.fuxa;

        this.on('input', async function(msg) {
            try {
                var now = Date.now();
                var start = timestamp(msg.start, config.start, now - 86400000, 'start');
                var end = timestamp(msg.end, config.end, now, 'end');
                if (start > end) {
                    throw new Error('Invalid alarm history range: start timestamp must not exceed end timestamp');
                }
                var alarms = await fuxa.getHistoryAlarms(start, end);
                msg.payload = alarms;
                node.send(msg);
            } catch (err) {
                node.error(err, msg);
            }
        });
    }
    RED.nodes.registerType("get-history-alarms", FuxaGetHistoryAlarmsNode);
}
