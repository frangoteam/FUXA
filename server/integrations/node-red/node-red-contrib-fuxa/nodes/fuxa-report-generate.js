module.exports = function(RED) {
    function FuxaGenerateReportNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        node.on('input', function(msg) {
            try {
                // Make HTTP request to generate report
                var http = require('http');
                var https = require('https');
                var url = require('url');

                var fuxaUrl = process.env.FUXA_URL || 'http://localhost:1881';
                var parsedUrl = url.parse(fuxaUrl);

                var options = {
                    hostname: parsedUrl.hostname,
                    port: parsedUrl.port,
                    path: '/api/advanced-reports/generate-with-data/' + config.report,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };

                var req = (parsedUrl.protocol === 'https:' ? https : http).request(options, function(res) {
                    var data = '';
                    res.on('data', function(chunk) {
                        data += chunk;
                    });
                    res.on('end', function() {
                        try {
                            var response = JSON.parse(data);
                            if (res.statusCode === 200) {
                                msg.payload = {
                                    success: true,
                                    report: config.report,
                                    fileName: response.fileName,
                                    path: response.path,
                                    reportData: reportData,
                                    tableData: tableData
                                };
                                node.send([msg, null]);
                            } else {
                                msg.payload = {
                                    success: false,
                                    error: response.message || 'Report generation failed'
                                };
                                node.send([null, msg]);
                            }
                        } catch (e) {
                            msg.payload = { success: false, error: e.message };
                            node.send([null, msg]);
                        }
                    });
                });

                req.on('error', function(err) {
                    msg.payload = { success: false, error: err.message };
                    node.send([null, msg]);
                });

                var reportData = {};
                var tableData = {};

                // Extract data from payload or message properties
                if (msg.payload && typeof msg.payload === 'object' && !Array.isArray(msg.payload)) {
                    // Direct message with combined data structure
                    reportData = msg.payload.reportData || {};
                    tableData = msg.payload.tableData || {};
                } else if (Array.isArray(msg.payload)) {
                    // Join node sent array of partial messages - merge them all
                    msg.payload.forEach(function(inputMsg) {
                        if (inputMsg && typeof inputMsg === 'object') {
                            if (inputMsg.reportData) {
                                Object.assign(reportData, inputMsg.reportData);
                            }
                            if (inputMsg.tableData) {
                                Object.assign(tableData, inputMsg.tableData);
                            }
                        }
                    });
                } else {
                    // Fallback to message properties
                    reportData = msg.reportData || {};
                    tableData = msg.tableData || {};
                }

                req.write(JSON.stringify({ reportData: reportData, tableData: tableData }));
                req.end();

            } catch (err) {
                node.error(err, msg);
            }
        });
    }
    RED.nodes.registerType("report-generate", FuxaGenerateReportNode);
}
