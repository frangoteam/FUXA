module.exports = function(RED) {
    function FuxaTableDataNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        node.on('input', function(msg) {
            try {
                var tableName = config.tableName || 'my-table';
                var includeTimestamp = config.includeTimestamp !== false; // default true
                var timestampFormat = config.timestampFormat || 'YYYY-MM-DDTHH:mm:ss.sssZ';
                var numberFormat = config.numberFormat || '0.00';
                var decimals = (numberFormat.split('.')[1] || '').length;

                // Convert historical data to table format
                var tableData = convertToTable(msg.payload, includeTimestamp, timestampFormat, decimals);

                msg.tableData = {};
                msg.tableData[tableName] = tableData;
                msg.payload = { tableData: msg.tableData };
                node.send(msg);

            } catch (err) {
                node.error(err, msg);
            }
        });

        function convertToTable(historicalData, includeTimestamp, timestampFormat, decimals) {
            if (!historicalData || typeof historicalData !== 'object') {
                return [['Timestamp', 'Value']];
            }

            function roundToSecond(ts) {
                var d = new Date(ts);
                d.setMilliseconds(0);
                return d.toISOString();
            }

            function formatTimestamp(ts, format) {
                var d = new Date(ts);
                
                // Extract date components
                var year = d.getFullYear();
                var month = String(d.getMonth() + 1).padStart(2, '0');
                var day = String(d.getDate()).padStart(2, '0');
                var hours = String(d.getHours()).padStart(2, '0');
                var minutes = String(d.getMinutes()).padStart(2, '0');
                var seconds = String(d.getSeconds()).padStart(2, '0');
                
                // Replace format tokens
                var formatted = format
                    .replace(/YYYY/g, year)
                    .replace(/MM/g, month)
                    .replace(/DD/g, day)
                    .replace(/HH/g, hours)
                    .replace(/mm/g, minutes)
                    .replace(/ss/g, seconds);
                
                return formatted;
            }

            function formatNumber(value) {
                if (value === null || value === undefined || value === '') {
                    return '';
                }
                var num = typeof value === 'number' ? value : parseFloat(value);
                if (isNaN(num)) {
                    return value; // Return original if not a number
                }
                return num.toFixed(decimals);
            }
            var timestamps = new Set();
            Object.keys(historicalData).forEach(tag => {
                if (Array.isArray(historicalData[tag])) {
                    historicalData[tag].forEach(point => {
                        if (point && point.x) {
                            var rounded = roundToSecond(point.x);
                            timestamps.add(rounded);
                        }
                    });
                }
            });

            var sortedTimestamps = Array.from(timestamps).sort();
            var tagNames = Object.keys(historicalData);

            // Create table without header
            var table = [];

            // Create rows
            sortedTimestamps.forEach(timestamp => {
                var row = [];
                if (includeTimestamp) {
                    row.push(formatTimestamp(timestamp, timestampFormat));
                }
                tagNames.forEach(tag => {
                    var point = Array.isArray(historicalData[tag])
                        ? historicalData[tag].find(p => p && roundToSecond(p.x) === timestamp)
                        : null;
                    row.push(formatNumber(point && point.y !== undefined ? point.y : ''));
                });
                table.push(row);
            });

            return table;
        }
    }
    RED.nodes.registerType("report-table-data", FuxaTableDataNode);
}
