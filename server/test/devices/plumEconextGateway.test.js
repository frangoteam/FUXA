'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
const axios = require('axios');
// Test the bundled source without installing this optional plugin globally.
const driver = require('../../integrations/plum-econext-gateway');

describe('PLUM ecoNEXT Gateway device plugin', function () {
    let getStub;
    let postStub;

    const response = {
        data: {
            parameters: {
                42: { index: 42, name: 'DHW_Temperature', value: 45.5, type: 7, unit: 1, writable: false },
                43: { index: 43, name: 'DHW_SetPoint', value: 50, type: 4, unit: 1, writable: true, min: 30, max: 60 },
                44: { index: 44, name: 'DHW_Enabled', value: false, type: 10, writable: true },
                45: { index: 45, name: 'DHW_Mode', value: 'comfort', type: 12, writable: true },
                46: { index: 46, name: 'currentWebPage', value: 661, type: 5, writable: true }
            }
        }
    };

    beforeEach(function () {
        getStub = sinon.stub(axios, 'get').resolves(response);
        postStub = sinon.stub(axios, 'post').resolves({ data: { ok: true } });
    });

    afterEach(function () {
        sinon.restore();
    });

    function createClient() {
        const events = { emit: sinon.spy() };
        const data = {
            id: 'dev1', name: 'ecoMAX 360i', polling: 1000,
            property: { address: 'http://127.0.0.1:8000' },
            tags: {
                writable: { id: 'writable', name: 'DHW set point', address: '43', type: 'number', daq: {} },
                readonly: { id: 'readonly', name: 'DHW temperature', address: '42', type: 'number', daq: {} },
                enabled: { id: 'enabled', name: 'Hot water enabled', address: '44', type: 'boolean', daq: {} },
                mode: { id: 'mode', name: 'Hot water mode', address: '45', type: 'string', daq: {} },
                page: { id: 'page', name: 'Panel page', address: '46', type: 'number', daq: {} }
            }
        };
        const runtime = { scriptsMgr: { runScript: sinon.stub() } };
        return { client: driver.create(data, { info() {}, warn() {}, error() {} }, events, runtime), events };
    }

    it('discovers groups and parameters', async function () {
        const { client } = createClient();
        const groups = await client.browse(null);
        expect(groups).to.deep.include({ id: 'DHW', name: 'DHW', class: 'Object' });

        const parameters = await client.browse({ id: 'DHW' });
        expect(parameters).to.have.length(4);
        expect(parameters.find(item => item.id === '43')).to.include({
            name: 'DHW_SetPoint', class: 'Variable', type: 'number', writable: true
        });
    });

    it('searches parameters directly by index or name', async function () {
        const { client } = createClient();
        const byIndex = await client.browse({ search: '43' });
        expect(byIndex.map(item => item.name)).to.deep.equal(['DHW_SetPoint']);
        const byName = await client.browse({ search: 'enabled' });
        expect(byName.map(item => item.id)).to.deep.equal(['44']);
    });

    it('prefers an exact numeric index and sorts numeric results', async function () {
        const { client } = createClient();
        const exact = await client.browse({ search: '43', sort: 'desc' });
        expect(exact.map(item => item.id)).to.deep.equal(['43']);
        const ascending = await client.browse({ search: 'DHW', sort: 'asc' });
        expect(ascending.map(item => item.id)).to.deep.equal(['42', '43', '44', '45']);
        const descending = await client.browse({ search: 'DHW', sort: 'desc' });
        expect(descending.map(item => item.id)).to.deep.equal(['45', '44', '43', '42']);
    });

    it('writes only writable parameters', async function () {
        const { client } = createClient();
        await client.connect();
        expect(await client.setValue('readonly', 48)).to.equal(false);
        expect(await client.setValue('writable', 52)).to.equal(true);
        expect(postStub.calledOnceWith(
            'http://127.0.0.1:8000/api/parameters/DHW_SetPoint',
            { value: 52 },
            sinon.match.object
        )).to.equal(true);
        expect(client.getValue('writable').value).to.equal(52);
        expect(client.getLastWriteResult()).to.include({
            parameter: 'DHW_SetPoint', index: 43, requestedValue: 52, status: 200
        });
        expect(client.getLastWriteResult().response).to.deep.equal({ ok: true });
    });

    it('keeps a FUXA-only alias independent from the gateway parameter name', async function () {
        const { client } = createClient();
        await client.connect();
        expect(client.getTagProperty('writable').name).to.equal('DHW set point');
        expect(await client.setValue('writable', 51)).to.equal(true);
        expect(postStub.firstCall.args[0]).to.equal('http://127.0.0.1:8000/api/parameters/DHW_SetPoint');
    });

    it('validates numeric limits', async function () {
        const { client } = createClient();
        await client.connect();
        for (const [value, message] of [[29, 'below minimum'], [61, 'above maximum']]) {
            let error;
            try { await client.setValue('writable', value); } catch (caught) { error = caught; }
            expect(error.message).to.include(message);
        }
        expect(postStub.notCalled).to.equal(true);
    });

    it('writes boolean and string values using their gateway types', async function () {
        const { client } = createClient();
        await client.connect();
        expect(await client.setValue('enabled', 'true')).to.equal(true);
        expect(await client.setValue('mode', 'eco')).to.equal(true);
        expect(postStub.firstCall.args[1]).to.deep.equal({ value: true });
        expect(postStub.secondCall.args[1]).to.deep.equal({ value: 'eco' });
    });

    it('accepts an OpenAPI JSON number for a uint16 parameter', async function () {
        const { client } = createClient();
        await client.connect();
        expect(await client.setValue('page', '696')).to.equal(true);
        expect(postStub.firstCall.args[1]).to.deep.equal({ value: 696 });
    });

    it('enforces integer protocol types and their ranges', async function () {
        const { client } = createClient();
        await client.connect();
        for (const [value, message] of [[696.5, 'must be an integer'], [65536, 'uint16 maximum']]) {
            let error;
            try { await client.setValue('page', value); } catch (caught) { error = caught; }
            expect(error.message).to.include(message);
        }
        expect(postStub.notCalled).to.equal(true);
    });

    it('rejects ambiguous boolean values instead of converting them to false', async function () {
        const { client } = createClient();
        await client.connect();
        let error;
        try { await client.setValue('enabled', 'enabled'); } catch (caught) { error = caught; }
        expect(error.message).to.include('Invalid boolean value');
        expect(postStub.notCalled).to.equal(true);
    });

    it('maps FUXA types from ecoNEXT protocol type codes', async function () {
        const { client } = createClient();
        const parameters = await client.browse({ search: 'DHW' });
        expect(parameters.find(item => item.id === '42').type).to.equal('number');
        expect(parameters.find(item => item.id === '44').type).to.equal('boolean');
        expect(parameters.find(item => item.id === '45').type).to.equal('string');
        expect(parameters.find(item => item.id === '44').econextType).to.equal(10);
        const page = await client.browse({ search: 'currentWebPage' });
        expect(page[0].econextTypeName).to.equal('uint16');
    });

    it('publishes polled values as an object keyed by string tag ids', async function () {
        const { client, events } = createClient();
        await client.connect();
        await client.polling();
        expect(client.getValues()).to.include.keys('writable', 'readonly', 'enabled', 'mode');
        const valueEvent = events.emit.getCalls().find(call => call.args[0] === 'device-value:changed');
        expect(valueEvent.args[1].values).to.be.an('object').and.not.an('array');
        expect(valueEvent.args[1].values.readonly.value).to.equal(45.5);
    });
});
