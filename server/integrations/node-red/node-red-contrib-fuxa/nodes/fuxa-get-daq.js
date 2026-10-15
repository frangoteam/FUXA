module.exports = function(RED) {
    function hasTimestamp(value) {
        return value !== undefined && value !== null &&
            !(typeof value === 'string' && value.trim() === '');
    }

    function timestamp(messageValue, configuredValue, fallback, name) {
        var value = hasTimestamp(messageValue) ? messageValue :
            (hasTimestamp(configuredValue) ? configuredValue : fallback);
        if (typeof value === 'string') {
            value = value.trim();
            // Numeric strings represent milliseconds, not a date such as year "0".
            value = /^-?\d+(?:\.\d+)?$/.test(value) ? Number(value) : Date.parse(value);
        }
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            throw new Error('Invalid ' + name + ' timestamp: use milliseconds or a valid date string');
        }
        return value;
    }

    function FuxaGetDaqNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
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
                    var now = Date.now();
                    var fromts = timestamp(msg.from, config.from, now - 3600000, 'from');
                    var tots = timestamp(msg.to, config.to, now, 'to');
                    if (fromts > tots) {
                        throw new Error('Invalid DAQ range: from timestamp must not exceed to timestamp');
                    }
                    var data = await fuxa.getDaq(tagId, fromts, tots);
                    msg.payload = data;
                    node.send(msg);
                } else {
                    node.error('Tag not found: ' + (config.tag || config.tagId), msg);
                }
            } catch (err) {
                node.error(err, msg);
            }
        });
    }
    RED.nodes.registerType("get-daq", FuxaGetDaqNode);
}
