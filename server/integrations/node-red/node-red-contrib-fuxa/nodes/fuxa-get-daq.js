module.exports = function(RED) {
    function FuxaGetDaqNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var fuxa = RED.settings.functionGlobalContext.fuxa;

        this.on('input', async function(msg) {
            try {
                var tagId = fuxa.getTagId(config.tag, null);
                if (tagId) {
                    var fromts = config.from || msg.from || Date.now() - 3600000; // default 1 hour ago
                    var tots = config.to || msg.to || Date.now();
                    var data = await fuxa.getDaq(tagId, fromts, tots);
                    msg.payload = data;
                    node.send(msg);
                } else {
                    node.error('Tag not found: ' + config.tag, msg);
                }
            } catch (err) {
                node.error(err, msg);
            }
        });
    }
    RED.nodes.registerType("get-daq", FuxaGetDaqNode);
}