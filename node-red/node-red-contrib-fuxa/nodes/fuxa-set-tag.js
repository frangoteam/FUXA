module.exports = function(RED) {
    function FuxaSetTagNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var fuxa = this.context().global.get('fuxa');

        this.on('input', async function(msg) {
            try {
                var tagId = fuxa.getTagId(config.tag, null);
                if (tagId) {
                    await fuxa.setTag(tagId, msg.payload);
                    node.send(msg);
                } else {
                    node.error('Tag not found: ' + config.tag, msg);
                }
            } catch (err) {
                node.error(err, msg);
            }
        });
    }
    RED.nodes.registerType("set-tag", FuxaSetTagNode);
}