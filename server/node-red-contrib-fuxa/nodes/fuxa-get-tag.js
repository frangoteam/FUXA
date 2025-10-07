module.exports = function(RED) {
    function FuxaGetTagNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var fuxa = this.context().global.get('fuxa');

        this.on('input', function(msg) {
            try {
                var tagId = fuxa.getTagId(config.tag, null);
                if (tagId) {
                    var value = fuxa.getTag(tagId);
                    msg.payload = value;
                    node.send(msg);
                } else {
                    node.error('Tag not found: ' + config.tag, msg);
                }
            } catch (err) {
                node.error(err, msg);
            }
        });
    }
    RED.nodes.registerType("get-tag", FuxaGetTagNode);
}