module.exports = function(RED) {
    function FuxaSetTagNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        // Access FUXA functions from global context
        var fuxa = RED.settings.functionGlobalContext.fuxa;

        this.on('input', async function(msg) {
            try {
                // Prefer config.tagId, fallback to config.tag for backward compatibility
                var tagId = config.tagId;
                if (!tagId && config.tag) {
                    // Backward compatibility: old nodes use tag.name, need to convert to tagId
                    tagId = fuxa.getTagId(config.tag, null);
                }
                
                if (tagId) {
                    await fuxa.setTag(tagId, msg.payload);
                    node.send(msg);
                } else {
                    node.error('Tag not found: ' + (config.tag || config.tagId), msg);
                }
            } catch (err) {
                node.error(err, msg);
            }
        });
    }
    RED.nodes.registerType("set-tag", FuxaSetTagNode);
}