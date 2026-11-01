const assert = require('node:assert/strict');
const http = require('node:http');
const {EventEmitter} = require('node:events');
const driver = require('../../runtime/devices/httprequest');

describe('WebAPI configured write endpoint', function () {
    let server, origin, requests, client, completion, finish, errors, respond;
    beforeEach(async function () {
        requests = [];
        errors = [];
        completion = new Promise(resolve => { finish = resolve; });
        respond = (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(req.method === 'GET' ? JSON.stringify([{id: 'tag', value: 17}]) : '{}');
        };
        server = http.createServer((req, res) => {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                requests.push({method: req.method, url: req.url, body: body ? JSON.parse(body) : null});
                respond(req, res);
            });
        });
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        origin = 'http://127.0.0.1:' + server.address().port;
    });
    afterEach(async function () {
        if (client) await client.disconnect();
        await new Promise(resolve => server.close(resolve));
        client = null;
    });
    async function create(property, tag = {id: 'tag', name: 'Tag', type: 'number'}) {
        const data = {id: 'device', name: 'Device', polling: 1000, property, tags: {tag}};
        client = driver.create(data, {
            info(message) { if (message.startsWith('setValue ')) finish(); },
            error(message) { errors.push(message); finish(); }, warn() {}
        }, new EventEmitter());
        client.load(data);
        await client.connect();
    }
    for (const scenario of [
        {name: "false text", type: 'boolean', value: "false", expected: false},
        {name: "zero text", type: 'boolean', value: "0", expected: false},
        {name: "padded false text", type: 'boolean', value: " FALSE ", expected: false},
        {name: "empty text", type: 'boolean', value: "", expected: false},
        {name: "native false", type: 'boolean', value: false, expected: false},
        {name: "native true", type: 'boolean', value: true, expected: true},
        {name: "true text", type: 'boolean', value: "true", expected: true},
        {name: "one text", type: 'boolean', value: "1", expected: true},
        {name: 'number', type: 'number', value: '42', expected: 42},
        {name: 'string', type: 'string', value: 'RUN', expected: 'RUN'},
        {name: 'zero', type: 'number', value: 0, expected: 0},
        {name: 'scaled number', type: 'number', value: 50, expected: 5,
            scale: {mode: 'linear', rawLow: 0, rawHigh: 10, scaledLow: 0, scaledHigh: 100}}
    ]) {
        it('posts ' + scenario.name + ' to postTags and still polls getTags', async function () {
            await create({getTags: origin + '/read', postTags: origin + '/write'},
                {id: 'tag', name: 'Tag', type: scenario.type, scale: scenario.scale});
            assert.equal(await client.setValue('tag', scenario.value), true);
            await completion;
            assert.deepEqual(requests, [{method: 'POST', url: '/write', body: [{id: 'tag', value: scenario.expected}]}]);
            assert.deepEqual(errors, []);
            await client.polling();
            assert.equal(requests[1].method, 'GET');
            assert.equal(requests[1].url, '/read');
            assert.equal(client.getValue('tag').value, scenario.scale ? 170 : 17);
        });
    }
    it('preserves a shared read/write endpoint', async function () {
        await create({getTags: origin + '/shared', postTags: origin + '/shared'});
        assert.equal(await client.setValue('tag', 9), true);
        await completion;
        assert.deepEqual(requests, [{method: 'POST', url: '/shared', body: [{id: 'tag', value: 9}]}]);
        assert.deepEqual(errors, []);
    });
    it('does not write in external-address mode', async function () {
        await create({address: origin + '/external', postTags: origin + '/write'});
        assert.equal(await client.setValue('tag', 9), false);
        assert.deepEqual(requests, []);
    });
    it('waits for the POST response before reporting success', async function () {
        let response, received;
        const requestReceived = new Promise(resolve => { received = resolve; });
        respond = (req, res) => { response = res; received(); };
        await create({getTags: origin + '/read', postTags: origin + '/write'});
        let settled = false;
        const write = client.setValue('tag', 9).then(result => { settled = true; return result; });
        try {
            await requestReceived;
            await new Promise(resolve => setImmediate(resolve));
            assert.equal(settled, false);
        } finally {
            response.end('{}');
            await write;
            await completion;
        }
        assert.equal(await write, true);
        assert.deepEqual(errors, []);
    });
    it('reports an HTTP failure as an unsuccessful write', async function () {
        respond = (req, res) => { res.statusCode = 500; res.end('{}'); };
        await create({getTags: origin + '/read', postTags: origin + '/write'});
        const result = await client.setValue('tag', 9);
        await completion;
        assert.equal(result, false);
        assert.equal(requests.length, 1);
        assert.equal(errors.length, 1);
        assert.match(errors[0], /setValue 'Tag' error!/);
    });
    it('reports a reset connection as an unsuccessful write', async function () {
        respond = (req, res) => { res.destroy(); };
        await create({getTags: origin + '/read', postTags: origin + '/write'});
        const result = await client.setValue('tag', 9);
        await completion;
        assert.equal(result, false);
        assert.equal(requests.length, 1);
        assert.equal(errors.length, 1);
        assert.match(errors[0], /setValue 'Tag' error!/);
    });
    it('accepts a successful response without a body', async function () {
        respond = (req, res) => { res.statusCode = 204; res.end(); };
        await create({getTags: origin + '/read', postTags: origin + '/write'});
        assert.equal(await client.setValue('tag', 9), true);
        await completion;
        assert.equal(requests.length, 1);
        assert.deepEqual(errors, []);
    });
    it('keeps writes disabled when postTags is missing', async function () {
        await create({getTags: origin + '/read'});
        assert.equal(await client.setValue('tag', 9), false);
        assert.deepEqual(requests, []);
        assert.equal(errors.length, 1);
        assert.match(errors[0], /postTags undefined/);
    });
});
