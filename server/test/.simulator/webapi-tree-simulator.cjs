const http = require('node:http');


const payload = {
    Objects: {
        // Prefix-related siblings reproduce the OPC UA tree-ordering report.
        cepn1: {
            value: 11,
            status: 'short-prefix child'
        },
        cepn116: {
            value: 116,
            status: 'long-prefix child'
        },
        lent10: {
            value: 10,
            status: 'short-prefix child'
        },
        lent104: {
            value: 104,
            status: 'long-prefix child'
        },
        // Extra depth and an array exercise nested WebAPI tree construction.
        nested: {
            level1: {
                level2: {
                    value: 'deeply nested value'
                }
            }
        },
        items: [
            { name: 'first', value: 1 },
            { name: 'second', value: 2 }
        ]
    }
};

function createServer() {
    return http.createServer((request, response) => {
        if (request.method !== 'GET' || request.url !== '/api/tags') {
            response.writeHead(404, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ error: 'Use GET /api/tags' }));
            return;
        }

        response.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
        });
        response.end(JSON.stringify(payload));
    });
}

if (require.main === module) {
    const port = Number(process.env.PORT) || 1888;
    createServer().listen(port, '0.0.0.0', () => {
        console.log(`WebAPI tree simulator: http://localhost:${port}/api/tags`);
    });
}

module.exports = { createServer, payload };
