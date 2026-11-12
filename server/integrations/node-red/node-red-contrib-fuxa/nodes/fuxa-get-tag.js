module.exports = function(RED) {
    function snapshotValue(value) {
        // Node-RED clones retain Buffer backing memory; detach it from live tag storage.
        function detachBuffers(copy, seen = new WeakSet()) {
            if (Buffer.isBuffer(copy)) return Buffer.from(copy);
            if (copy && typeof copy === 'object' && !seen.has(copy)) {
                seen.add(copy);
                Object.keys(copy).forEach(key => {
                    copy[key] = detachBuffers(copy[key], seen);
                });
            }
            return copy;
        }
        return detachBuffers(RED.util.cloneMessage({ payload: value }).payload);
    }

    function FuxaGetTagNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Access FUXA functions from global context
        const fuxa = RED.settings?.functionGlobalContext?.fuxa;

        node.on("input", function(msg, send, done) {
            send = send || node.send.bind(node);

            try {
                if (!fuxa) {
                    node.error("FUXA not available in functionGlobalContext", msg);
                    return done && done();
                }

                const uiTag = (typeof config.tag === "string") ? config.tag.trim() : "";
                const topicTag = (typeof msg.topic === "string") ? msg.topic.trim() : "";
                const tagRef = uiTag || topicTag;
                let tagId = config.tagId || null;

                // Keep master behavior (prefer configured tagId), then fallback to UI tag/topic lookup.
                if (!tagId && !tagRef) {
                    node.error("No tag provided: set Tag in the node OR provide msg.topic", msg);
                    return done && done();
                }

                if (!tagId) {
                    tagId = fuxa.getTagId(tagRef, null);
                }

                if (!tagId) {
                    node.error("Tag not found: " + tagRef, msg);
                    return done && done();
                }

                const value = fuxa.getTag(tagId);

                msg.payload = snapshotValue(value);
                if (tagRef) {
                    msg.topic = tagRef;
                } else if (typeof config.tag === "string" && config.tag.trim()) {
                    msg.topic = config.tag.trim();
                }

                send(msg);
                return done && done();
            } catch (err) {
                node.error(err, msg);
                return done && done(err);
            }
        });
    }

    RED.nodes.registerType("get-tag", FuxaGetTagNode);
};
