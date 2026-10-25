module.exports = function(RED) {
    function FuxaGetDeviceNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var fuxa = RED.settings.functionGlobalContext.fuxa;

        this.on('input', async function(msg) {
            try {
                var deviceName = msg.deviceName || config.deviceName;
                var includeTags = (msg.includeTags !== undefined) ? msg.includeTags : (config.includeTags !== undefined ? config.includeTags : true);

                if (deviceName) {
                    var device = await fuxa.getDevice(deviceName, includeTags);
                    msg.payload = device;
                    node.send(msg);
                } else {
                    node.error('Device name not specified', msg);
                }
            } catch (err) {
                node.error(err, msg);
            }
        });
    }
    RED.nodes.registerType("get-device", FuxaGetDeviceNode);
}
