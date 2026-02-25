module.exports = function(RED) {
    function FuxaSetTagNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Access FUXA functions from global context
        const fuxa = RED.settings?.functionGlobalContext?.fuxa;

        node.on("input", async function(msg, send, done) {
            send = send || node.send.bind(node);

            try {
                if (!fuxa) {
                    node.error("FUXA not available in functionGlobalContext", msg);
                    return done && done();
                }

                const uiTag = (typeof config.tag === "string") ? config.tag.trim() : "";
                const topicTag = (typeof msg.topic === "string") ? msg.topic.trim() : "";

                // If UI tag is empty, fall back to msg.topic
                const tagRef = uiTag !== "" ? uiTag : topicTag;

                // Only error if BOTH are missing/empty
                if (!tagRef) {
                    node.error("No tag provided: set Tag in the node OR provide msg.topic", msg);
                    return done && done();
                }

                const tagId = fuxa.getTagId(tagRef, null);

                if (tagId) {
                    await fuxa.setTag(tagId, msg.payload);
                    send(msg);
                    return done && done();
                } else {
                    node.error("Tag not found: " + tagRef, msg);
                    return done && done();
                }
            } catch (err) {
                node.error(err, msg);
                return done && done(err);
            }
        });
    }

    RED.nodes.registerType("set-tag", FuxaSetTagNode);
};