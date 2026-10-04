'use strict';

const {
    createNodeRedRuntimeHelpers,
    normalizeScriptParameters,
} = require('../../integrations/node-red');

describe('Node-RED FUXA runtime helpers', () => {
    let expect;
    let commands;
    let enabledCalls;
    let daqWrite;
    let runCalls;
    let runtime;
    let devices;
    let helpers;

    before(async () => {
        const chai = await import('chai');
        expect = chai.expect;
    });

    beforeEach(() => {
        commands = [];
        enabledCalls = [];
        daqWrite = null;
        runCalls = [];

        runtime = {
            scriptSendCommand(command) {
                commands.push(command);
            },
            project: {
                getDevice(name) {
                    if (name !== 'PLC-1') return null;
                    return {
                        id: 'dev-1',
                        name: 'PLC-1',
                        type: 'ModbusTCP',
                        enabled: true,
                        property: {
                            address: '10.0.0.10',
                            password: 'must-not-leak',
                        },
                        tags: {
                            t1: { id: 'tag-1', name: 'Pressure', address: '40001' },
                            t2: { id: 'tag-2', name: 'Flow', address: '40002' },
                        },
                    };
                },
                async getScripts() {
                    return [{
                        id: 'script-1',
                        name: 'calculate',
                        parameters: [
                            { name: 'a', value: 1 },
                            { name: 'b', value: 2 },
                        ],
                    }];
                },
            },
            scriptsMgr: {
                runScript(script, toLogEvent) {
                    runCalls.push({ script, toLogEvent });
                    return 'ok';
                },
            },
        };

        devices = {
            enableDevice(deviceName, enable) {
                enabledCalls.push({ deviceName, enable });
            },
            getDevicesStatus() {
                return { 'dev-1': 'connected' };
            },
            getTagDaqSettings(tagId) {
                return { tagId, enabled: true };
            },
            setTagDaqSettings(tagId, settings) {
                daqWrite = { tagId, settings };
                return true;
            },
        };

        helpers = createNodeRedRuntimeHelpers(runtime, devices);
    });

    it('bridges set-view and open-card through the existing script command channel', () => {
        expect(helpers.setView('Overview', true)).to.equal(true);
        expect(helpers.openCard('Pump details', { singleCard: true })).to.equal(true);

        expect(commands).to.deep.equal([
            { command: 'SETVIEW', params: ['Overview', true] },
            { command: 'OPENCARD', params: ['Pump details', { singleCard: true }] },
        ]);
    });

    it('forwards device enable and tag DAQ operations to the device manager', () => {
        expect(helpers.enableDevice('PLC-1', false)).to.equal(true);
        expect(enabledCalls).to.deep.equal([{ deviceName: 'PLC-1', enable: false }]);

        expect(helpers.getTagDaqSettings('tag-1')).to.deep.equal({ tagId: 'tag-1', enabled: true });
        expect(helpers.setTagDaqSettings('tag-1', { interval: 5000 })).to.equal(true);
        expect(daqWrite).to.deep.equal({ tagId: 'tag-1', settings: { interval: 5000 } });
    });

    it('returns a safe device summary without exposing connection properties or secrets', () => {
        const summary = helpers.getDevice('PLC-1', true);

        expect(summary).to.deep.equal({
            id: 'dev-1',
            name: 'PLC-1',
            type: 'ModbusTCP',
            enabled: true,
            status: 'connected',
            tags: [
                { id: 'tag-1', name: 'Pressure' },
                { id: 'tag-2', name: 'Flow' },
            ],
        });
        expect(summary).to.not.have.property('property');
    });

    it('can omit tags from the safe device summary', () => {
        expect(helpers.getDevice('PLC-1', false)).to.deep.equal({
            id: 'dev-1',
            name: 'PLC-1',
            type: 'ModbusTCP',
            enabled: true,
            status: 'connected',
        });
        expect(helpers.getDevice('missing', true)).to.equal(null);
    });

    it('passes Node-RED payload values to script parameters without mutating the project script', async () => {
        const result = await helpers.runScript('calculate', { a: 10, b: 20 });

        expect(result).to.equal('ok');
        expect(runCalls).to.have.length(1);
        expect(runCalls[0].toLogEvent).to.equal(false);
        expect(runCalls[0].script.parameters).to.deep.equal([10, 20]);

        const scripts = await runtime.project.getScripts();
        expect(scripts[0].parameters).to.deep.equal([
            { name: 'a', value: 1 },
            { name: 'b', value: 2 },
        ]);
    });

    it('supports array payloads and treats an empty object as no script parameters', async () => {
        await helpers.runScript('calculate', ['left', 'right']);
        expect(runCalls[0].script.parameters).to.deep.equal(['left', 'right']);

        runCalls.length = 0;
        await helpers.runScript('calculate', {});
        expect(runCalls[0].script.parameters).to.deep.equal([]);
    });

    it('normalizes a scalar or object payload as a single parameter when names do not match', () => {
        const script = { parameters: [{ name: 'config' }] };

        expect(normalizeScriptParameters(script, 5)).to.deep.equal([5]);
        expect(normalizeScriptParameters(script, { threshold: 7 })).to.deep.equal([{ threshold: 7 }]);
    });
});
