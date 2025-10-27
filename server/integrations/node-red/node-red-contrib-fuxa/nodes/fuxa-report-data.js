module.exports = function(RED) {
    function FuxaReportDataNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        node.on('input', function(msg) {
            try {
                var numberFormat = config.numberFormat || '0.00';
                var decimals = (numberFormat.split('.')[1] || '').length;

                // Extract scalar values from payload and set as reportData
                var reportData = {};

                if (typeof msg.payload === 'number' || typeof msg.payload === 'string') {
                    // Direct scalar value from get-tag
                    var key = msg.topic || 'value';
                    var value = msg.payload;
                    var num = typeof value === 'number' ? value : parseFloat(value);
                    if (!isNaN(num)) {
                        value = num.toFixed(decimals);
                    }
                    reportData[key] = value;
                } else if (typeof msg.payload === 'object' && msg.payload !== null) {
                    // Object with multiple values - copy all scalar values
                    Object.keys(msg.payload).forEach(function(key) {
                        var value = msg.payload[key];
                        if (typeof value === 'boolean') {
                            reportData[key] = value;
                        } else if (value === null || value === undefined) {
                            reportData[key] = value;
                        } else {
                            var num = typeof value === 'number' ? value : parseFloat(value);
                            if (!isNaN(num)) {
                                reportData[key] = num.toFixed(decimals);
                            } else {
                                reportData[key] = value; // Keep original if not a number
                            }
                        }
                    });
                }

                msg.reportData = reportData;
                msg.payload = { reportData: reportData };
                node.send(msg);

            } catch (err) {
                node.error(err, msg);
            }
        });
    }
    RED.nodes.registerType("report-data", FuxaReportDataNode);
}