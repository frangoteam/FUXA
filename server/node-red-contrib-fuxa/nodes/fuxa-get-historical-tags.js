module.exports = function(RED) {
    function FuxaGetHistoricalTagsNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var fuxa = RED.settings.functionGlobalContext.fuxa;

        this.on('input', async function(msg) {
            try {
                var tags = config.tags || msg.tags;
                
                // Handle new JSON format
                if (typeof tags === 'string' && tags.startsWith('[')) {
                    try {
                        tags = JSON.parse(tags);
                    } catch(e) {
                        // Fallback to old comma-separated format
                        tags = tags.split(',').map(tag => tag.trim());
                    }
                } else if (typeof tags === 'string') {
                    // Old comma-separated format
                    tags = tags.split(',').map(tag => tag.trim());
                }
                
                var fromts = config.from || msg.from || Date.now() - 3600000; // default 1 hour ago
                var tots = config.to || msg.to || Date.now();

                if (tags && Array.isArray(tags) && tags.length > 0) {
                    var data = await fuxa.getHistoricalTags(tags, fromts, tots);
                    msg.payload = data;
                    node.send(msg);
                } else {
                    node.error('Tags not specified or invalid format', msg);
                }
            } catch (err) {
                node.error(err, msg);
            }
        });
    }
    RED.nodes.registerType("get-historical-tags", FuxaGetHistoricalTagsNode);
}