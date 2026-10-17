module.exports = function(RED) {
    function FuxaGetHistoricalTagsNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var fuxa = this.context().global.get('fuxa');

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

                // Convert string timestamps to numbers if needed
                if (typeof fromts === 'string') {
                    fromts = new Date(fromts).getTime();
                }
                if (typeof tots === 'string') {
                    tots = new Date(tots).getTime();
                }

                // Convert tag names to tag IDs (like advanced reports do)
                var tagIds = [];
                var resolvedTags = [];
                for (var i = 0; i < tags.length; i++) {
                    var tagId = fuxa.getTagId(tags[i]);
                    if (tagId) {
                        tagIds.push(tagId);
                        resolvedTags.push({ id: tagId, name: tags[i] });
                    } else {
                        node.warn('Tag not found: ' + tags[i]);
                    }
                }

                if (tagIds.length > 0) {
                    var data = await fuxa.getHistoricalTags(tagIds, fromts, tots);
                    
                    // Filter out null values and convert to the expected format (like advanced reports)
                    var filteredData = {};
                    for (var resolvedTag of resolvedTags) {
                        if (Object.prototype.hasOwnProperty.call(data, resolvedTag.id)) {
                            var tagData = data[resolvedTag.id].filter(function(item) {
                                return item && item.x !== undefined && item.y !== undefined && item.y !== null;
                            });
                            // Keep the name paired with its ID even when other lookups fail.
                            // Define an own key so names such as "__proto__" remain data.
                            Object.defineProperty(filteredData, resolvedTag.name, {
                                value: tagData, enumerable: true, writable: true, configurable: true
                            });
                        }
                    }
                    
                    msg.payload = filteredData;
                    msg.topic = resolvedTags[0].name;  // First resolved tag for join operations
                    node.send(msg);
                } else {
                    node.error('No valid tags found', msg);
                }
            } catch (err) {
                node.error(err, msg);
            }
        });
    }
    RED.nodes.registerType("get-historical-tags", FuxaGetHistoricalTagsNode);
}
