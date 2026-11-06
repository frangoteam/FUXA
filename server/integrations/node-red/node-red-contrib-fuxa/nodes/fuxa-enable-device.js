module.exports = function(RED) {
    function FuxaEnableDeviceNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var fuxa = RED.settings.functionGlobalContext.fuxa;

        this.on('input', async function(msg) {
            try {
                var deviceName = msg.deviceName || config.deviceName;
                var enabled = (msg.enabled !== undefined) ? msg.enabled : (config.enabled !== undefined ? config.enabled : true);

                if (deviceName) {
                    var result = await fuxa.enableDevice(deviceName, enabled);
                    msg.payload = result;
                    node.send(msg);
                } else {
                    node.error('Device name not specified', msg);
                }
            } catch (err) {
                node.error(err, msg);
            }
        });
    }
    RED.nodes.registerType("enable-device", FuxaEnableDeviceNode);
}
