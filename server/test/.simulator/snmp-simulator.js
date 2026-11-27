#!/usr/bin/env node
'use strict';

// Local SNMP v1/v2c agent for testing FUXA's browse/scan UI.
// Uses the net-snmp dependency already installed by the FUXA server.
const snmp = require('net-snmp');

const args = process.argv.slice(2);
function option(name, fallback) {
    const index = args.indexOf(name);
    return index < 0 ? fallback : args[index + 1];
}

const address = option('--host', '127.0.0.1');
const port = Number(option('--port', '16161'));
const community = option('--community', 'fuxa-community');

const agent = snmp.createAgent({ port, address }, () => {
    // Invalid-community requests are expected to be silently rejected.
});
const mib = agent.getMib();

const providers = [
    {
        name: 'sysDescr', oid: '1.3.6.1.2.1.1.1',
        type: snmp.ObjectType.OctetString,
        value: 'FUXA local SNMP simulator'
    },
    {
        name: 'sysUpTime', oid: '1.3.6.1.2.1.1.3',
        type: snmp.ObjectType.TimeTicks,
        value: 123456
    },
    {
        name: 'sysContact', oid: '1.3.6.1.2.1.1.4',
        type: snmp.ObjectType.OctetString,
        value: 'fuxa@example.local'
    },
    {
        name: 'sysName', oid: '1.3.6.1.2.1.1.5',
        type: snmp.ObjectType.OctetString,
        value: 'fuxa-snmp-simulator'
    },
    {
        name: 'sysLocation', oid: '1.3.6.1.2.1.1.6',
        type: snmp.ObjectType.OctetString,
        value: 'localhost'
    },
    {
        name: 'ifNumber', oid: '1.3.6.1.2.1.2.1',
        type: snmp.ObjectType.Integer,
        value: 2
    },
    {
        name: 'simulatorTemperature', oid: '1.3.6.1.4.1.8072.9999.1',
        type: snmp.ObjectType.Integer,
        value: 42
    },
    {
        name: 'simulatorStatus', oid: '1.3.6.1.4.1.8072.9999.2',
        type: snmp.ObjectType.OctetString,
        value: 'RUNNING'
    },
    {
        name: 'simulatorCounter', oid: '1.3.6.1.4.1.8072.9999.3',
        type: snmp.ObjectType.Counter32,
        value: 98765
    }
];

for (const provider of providers) {
    mib.registerProvider({
        name: provider.name,
        type: snmp.MibProviderType.Scalar,
        oid: provider.oid,
        scalarType: provider.type,
        maxAccess: snmp.MaxAccess['read-write']
    });
    mib.setScalarValue(provider.name, provider.value);
}

agent.getAuthorizer().addCommunity(community);

console.log(`SNMP simulator listening on ${address}:${port} (v1/v2c)`);
console.log(`Community: ${community}`);
console.log('For Scan, use the default subtree 1.3.6.1.2.1; sample OIDs are also available under 1.3.6.1.4.1.8072.9999.');
console.log('Configure the FUXA device for SNMP v2c with this host, port, and community.');

function shutdown() {
    agent.close(() => process.exit(0));
    // Do not keep the process alive if the UDP agent does not close promptly.
    setTimeout(() => process.exit(0), 1000).unref();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
