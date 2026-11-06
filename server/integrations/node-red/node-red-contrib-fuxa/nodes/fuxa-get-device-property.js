module.exports = function(RED) {
    function FuxaGetDevicePropertyNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var fuxa = RED.settings.functionGlobalContext.fuxa;

        this.on('input', async function(msg) {
            try {
                if (!fuxa || typeof fuxa.getDeviceProperty !== 'function') {
                    node.error('FUXA getDeviceProperty not available', msg);
                    return;
                }

                var deviceName = msg.deviceName || config.deviceName;
                var property = msg.property || config.property;

                if (deviceName && property) {
                    var result = await fuxa.getDeviceProperty(deviceName, property);
                    msg.payload = result;
                    node.send(msg);
                } else {
                    node.error('Device name and property not specified', msg);
                }
            } catch (err) {
                node.error(err, msg);
            }
        });
    }
    RED.nodes.registerType("get-device-property", FuxaGetDevicePropertyNode);
}
