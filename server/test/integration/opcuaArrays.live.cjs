'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { setTimeout: pause } = require('node:timers/promises');
const opcua = require('node-opcua');
const { EUInformation } = require('node-opcua-data-access');
const driver = require('../../runtime/devices/opcua');

async function run() {
    const server = new opcua.OPCUAServer({
        port: 24871, resourcePath: '/ArrayRegression', nodeset_filename: [opcua.nodesets.standard]
    });
    let device;
    try {
        await server.initialize();
        const ns = server.engine.addressSpace.getOwnNamespace();
        const object = ns.addObject({ organizedBy: server.engine.addressSpace.rootFolder.objects, browseName: 'Fixtures' });
        const variables = {};
        function addVariable(name, dataType, typeName, value) {
            variables[name] = ns.addVariable({
                componentOf: object, browseName: name, nodeId: `s=${name}`, dataType: typeName,
                valueRank: 1, arrayDimensions: [0],
                value: new opcua.Variant({ dataType, arrayType: opcua.VariantArrayType.Array, value })
            });
        }
        addVariable('Numbers', opcua.DataType.Double, 'Double', [10, 20, 30]);
        addVariable('Singleton', opcua.DataType.Double, 'Double', [42]);
        addVariable('Empty', opcua.DataType.Double, 'Double', []);
        addVariable('Recipes', opcua.DataType.ExtensionObject, 'EUInformation', ['First', 'Last'].map((name, i) =>
            new EUInformation({ namespaceUri: 'urn:array-regression', unitId: i + 1, displayName: { text: name } })
        ));
        await server.start();
        const tags = {};
        for (const name of Object.keys(variables)) {
            tags[name] = { name, address: `ns=${ns.index};s=${name}`, type: 'Double',
                daq: { enabled: true, changed: true } };
        }
        const events = new EventEmitter();
        let lastEmission;
        let lastDaq;
        events.on('device-value:changed', event => { lastEmission = event.values; });
        const errors = [];
        let subscriptionReady = false;
        device = driver.create({
            id: 'live', name: 'Live array regression', polling: 100,
            property: { address: 'opc.tcp://localhost:24871/ArrayRegression' }, tags
        }, {
            info: message => { if (message.includes('subscription created!')) subscriptionReady = true; },
            warn() {}, error: message => errors.push(message)
        }, events, null, {});
        device.bindAddDaq(values => { lastDaq = { ...lastDaq, ...values }; });
        await device.connect();
        const readyDeadline = Date.now() + 20000;
        while (!subscriptionReady && Date.now() < readyDeadline) await pause(50);
        assert.ok(subscriptionReady, `Subscription creation timed out: ${errors.join('; ')}`);

        async function waitFor(check) {
            const deadline = Date.now() + 20000;
            while (Date.now() < deadline) {
                await device.polling();
                if (check()) return;
                await pause(50);
            }
            throw new Error(`Subscription values timed out: ${errors.join('; ')}`);
        }
        await waitFor(() => Object.keys(tags).every(id => device.getValue(id)?.value !== undefined));

        const expected = { Numbers: [10, 20, 30], Singleton: [42], Empty: [] };
        for (const [id, value] of Object.entries(expected)) {
            assert.deepEqual(Array.from(device.getValue(id).value), value);
            assert.deepEqual(Array.from(lastEmission[id].value), value);
            assert.deepEqual(Array.from(lastDaq[id].value), value);
        }
        for (const source of [device.getValue('Recipes'), lastEmission.Recipes, lastDaq.Recipes]) {
            assert.deepEqual(source.value.map(recipe => recipe.displayName.text), ['First', 'Last']);
        }
        console.log('PASS: live numeric, singleton, empty and ExtensionObject arrays through getValue, events and DAQ');

        variables.Singleton.setValueFromSource(new opcua.Variant({
            dataType: opcua.DataType.Double, arrayType: opcua.VariantArrayType.Array, value: [7, 8]
        }));
        await waitFor(() => device.getValue('Singleton')?.value?.length === 2);
        assert.deepEqual(Array.from(device.getValue('Singleton').value), [7, 8]);
        variables.Singleton.setValueFromSource(new opcua.Variant({
            dataType: opcua.DataType.Double, arrayType: opcua.VariantArrayType.Array, value: []
        }));
        await waitFor(() => device.getValue('Singleton')?.value?.length === 0);
        assert.deepEqual(Array.from(device.getValue('Singleton').value), []);
        assert.deepEqual(errors, []);
        console.log('PASS: live array updates and clearing to an empty array');
        console.log('LIVE OPC UA VALIDATION PASSED');
    } finally {
        if (device) await device.disconnect();
        await server.shutdown(0);
    }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
