module.exports = function(RED) {
    function FuxaGetTagDaqSettingsNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var fuxa = RED.settings.functionGlobalContext.fuxa;

        this.on('input', async function(msg) {
            try {
                var tagName = config.tag || msg.tag;
                if (tagName) {
                    var tagId = fuxa.getTagId(tagName, null);
                    if (tagId) {
                        var settings = await fuxa.getTagDaqSettings(tagId);
                        msg.payload = settings;
                        node.send(msg);
                    } else {
                        node.error('Tag not found: ' + tagName, msg);
                    }
                } else {
                    node.error('Tag name not specified', msg);
                }
            } catch (err) {
                node.error(err, msg);
            }
        });
    }
    RED.nodes.registerType("get-tag-daq-settings", FuxaGetTagDaqSettingsNode);
}