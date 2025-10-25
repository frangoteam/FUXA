module.exports = function(RED) {
    function FuxaGetTagChangeNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var fuxa = RED.settings.functionGlobalContext.fuxa;

        // Store previous values to detect actual changes
        var previousValues = {};

        // Initialize previous value for the configured tag
        if (config.tag) {
            var tagId = fuxa.getTagId(config.tag, null);
            if (tagId) {
                // Initialize previous value
                var initialValue = fuxa.getTag(tagId);
                if (initialValue !== undefined) {
                    previousValues[tagId] = initialValue;
                }
            }
        }

                        // Event listener for device value changes (raw events from devices)
        var deviceEventListener = function(deviceEvent) {
            try {
                // deviceEvent format: { id: deviceId, values: { tagId: tagObject, ... } }
                if (deviceEvent && deviceEvent.values) {
                    // Check if any of the changed values match our configured tag
                    var configuredTagId = fuxa.getTagId(config.tag, null);
                    
                    if (configuredTagId && deviceEvent.values[configuredTagId]) {
                        var tagData = deviceEvent.values[configuredTagId];
                        
                        // Get the current tag value directly from FUXA
                        var currentValue = fuxa.getTag(configuredTagId);
                        
                        if (currentValue !== undefined) {
                            // Check if the value has actually changed compared to our stored previous value
                            var previousValue = previousValues[configuredTagId];
                            if (previousValue !== currentValue) {
                                // Update previous value
                                previousValues[configuredTagId] = currentValue;

                                // Output the tag change
                                var outputMsg = {
                                    payload: currentValue,
                                    topic: config.tag || configuredTagId,
                                    tagId: configuredTagId,
                                    tagName: config.tag,
                                    timestamp: tagData.timestamp || new Date().toISOString(),
                                    previousValue: previousValue
                                };

                                node.send(outputMsg);
                            }
                        }
                    }
                }
            } catch (err) {
                // Silently handle errors
            }
        };

        // Register the event listener for device value changes (listen to all device changes and filter)
        fuxa.runtime.events.on('device-value:changed', deviceEventListener);

        // Clean up on node close
        this.on('close', function(done) {
            try {
                fuxa.runtime.events.removeListener('device-value:changed', deviceEventListener);
            } catch (err) {
                // Silently handle cleanup errors
            }
            done();
        });
    }

    RED.nodes.registerType("get-tag-change", FuxaGetTagChangeNode);
}