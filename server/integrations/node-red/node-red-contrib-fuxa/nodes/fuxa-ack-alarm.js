module.exports = function(RED) {
    function FuxaAckAlarmNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var fuxa = RED.settings.functionGlobalContext.fuxa;

        this.on('input', async function(msg) {
            try {
                var alarmName = msg.alarmName || msg.payload || config.alarmName;
                var types = (msg.types !== undefined && msg.types !== null) ? msg.types : config.types;
                if (typeof types === 'string') {
                    types = types.split(',').map(s => s.trim());
                }
                if (alarmName) {
                    var result = await fuxa.ackAlarm(alarmName, types);
                    msg.payload = result;
                    node.send(msg);
                } else {
                    node.error('Missing alarm name', msg);
                }
            } catch (err) {
                node.error(err, msg);
            }
        });
    }
    RED.nodes.registerType("ack-alarm", FuxaAckAlarmNode);
}
