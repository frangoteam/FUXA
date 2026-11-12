#!/usr/bin/env node
'use strict';

// Local BACnet/IP test device that rejects complete OBJECT_LIST reads with
// Abort: segmentationNotSupported, but supports array-indexed reads.
const Bacnet = require('../../_pkg/runtime/node_modules/node-bacnet');
const services = require('../../_pkg/runtime/node_modules/node-bacnet/lib/services');
const apdu = require('../../_pkg/runtime/node_modules/node-bacnet/lib/apdu');
const npdu = require('../../_pkg/runtime/node_modules/node-bacnet/lib/npdu');
const enums = Bacnet.enum;

const args = process.argv.slice(2);
function option(name, fallback) {
    const index = args.indexOf(name);
    return index < 0 ? fallback : args[index + 1];
}

// Use a distinct loopback address: node-bacnet intentionally ignores incoming
// services from 127.0.0.1, which would otherwise hide this simulator from FUXA.
const host = option('--host', '127.0.0.2');
const port = Number(option('--port', '47808'));
const announceTo = option('--announce-to', '127.0.0.1:47809');
const deviceId = Number(option('--device-id', '321'));
const objectCount = Number(option('--objects', '120'));

if (!Number.isInteger(port) || port < 1 || port > 65535 ||
    !Number.isInteger(deviceId) || deviceId < 0 || deviceId > 4194303 ||
    !Number.isInteger(objectCount) || objectCount < 1 || objectCount > 10000) {
    console.error('Invalid options. Port must be 1-65535, device ID 0-4194303, and objects 1-10000.');
    process.exit(1);
}

const sampleObjects = [
    { type: 0, instance: 1, name: 'Temperature', value: 22.6 },
    { type: 0, instance: 2, name: 'Pressure', value: 4.8 },
    { type: 1, instance: 1, name: 'Temperature Setpoint', value: 22.0 },
    { type: 1, instance: 2, name: 'Pressure Setpoint', value: 5.0 },
    { type: 2, instance: 1, name: 'Fan Speed Reference', value: 45.0 },
    { type: 3, instance: 1, name: 'Pump Running', value: 1 },
    { type: 4, instance: 1, name: 'Pump Command', value: 0 },
    { type: 5, instance: 1, name: 'Alarm Active', value: 0 }
];
const objects = sampleObjects.slice(0, objectCount);
for (let index = 0; objects.length < objectCount; index++) {
    const type = index % 6;
    objects.push({
        type,
        instance: 100 + Math.floor(index / 6),
        name: `Simulator ${['AI', 'AO', 'AV', 'BI', 'BO', 'BV'][type]} ${100 + Math.floor(index / 6)}`,
        value: type < 3 ? 20 + index / 10 : index % 2
    });
}
const objectNames = new Map(objects.map(object => [`${object.type}:${object.instance}`, object.name]));
const objectValues = new Map(objects.map(object => [`${object.type}:${object.instance}`, object.value]));

const client = new Bacnet({ interface: host, port, reuseAddr: false });

// node-bacnet's client normally discards incoming requests from 127.0.0.1.
// A simulator must accept local FUXA clients, so decode and emit these two
// service requests directly while retaining the library's packet parsing.
client._processServiceRequest = function (serviceMap, content, buffer, offset, length) {
    const service = serviceMap[content.service];
    if (service !== 'whoIs' && service !== 'readProperty' && service !== 'readPropertyMultiple' && service !== 'writeProperty') return;
    const handler = services[service];
    if (!handler) return;
    try {
        content.payload = handler.decode(buffer, offset, length);
    } catch (error) {
        console.error(`Cannot decode ${service} request: ${error.message}`);
        return;
    }
    if (content.payload) this.emit(service, content);
};

client.on('whoIs', request => {
    const limits = request.payload || {};
    if ((limits.lowLimit !== undefined && deviceId < limits.lowLimit) ||
        (limits.highLimit !== undefined && deviceId > limits.highLimit)) return;
    client.iAmResponse(request.header.sender, deviceId, enums.Segmentation.NO_SEGMENTATION, 999);
});

function propertyValue(objectId, propertyId) {
    if (propertyId === enums.PropertyIdentifier.OBJECT_NAME) {
        const name = objectId.type === enums.ObjectType.DEVICE && objectId.instance === deviceId
            ? 'FUXA BACnet simulator'
            : objectNames.get(`${objectId.type}:${objectId.instance}`);
        return name === undefined ? null : { type: enums.ApplicationTag.CHARACTER_STRING, value: name };
    }
    if (propertyId === enums.PropertyIdentifier.PRESENT_VALUE) {
        const value = objectValues.get(`${objectId.type}:${objectId.instance}`);
        if (value === undefined) return null;
        return {
            type: objectId.type < 3 ? enums.ApplicationTag.REAL : enums.ApplicationTag.ENUMERATED,
            value
        };
    }
    return null;
}

client.on('readPropertyMultiple', request => {
    const values = request.payload.properties.map(specification => ({
        objectId: specification.objectId,
        values: specification.properties.map(property => {
            const value = propertyValue(specification.objectId, property.id);
            return {
                property: { id: property.id, index: property.index === undefined ? enums.ASN1_ARRAY_ALL : property.index },
                value: value ? [value] : [{
                    type: enums.ApplicationTag.ERROR,
                    value: {
                        type: 'BacnetError',
                        errorClass: enums.ErrorClass.PROPERTY,
                        errorCode: enums.ErrorCode.UNKNOWN_PROPERTY
                    }
                }]
            };
        })
    }));
    client.readPropertyMultipleResponse(request.header.sender, request.invokeId, values);
});

client.on('writeProperty', request => {
    const { objectId, value } = request.payload;
    const key = `${objectId.type}:${objectId.instance}`;
    const isOutput = [1, 2, 4, 5].includes(objectId.type);
    const newValue = value.value[0] && value.value[0].value;
    if (!isOutput || value.property.id !== enums.PropertyIdentifier.PRESENT_VALUE || !objectValues.has(key)) {
        client.errorResponse(request.header.sender, enums.ConfirmedServiceChoice.WRITE_PROPERTY,
            request.invokeId, enums.ErrorClass.PROPERTY, enums.ErrorCode.WRITE_ACCESS_DENIED);
        return;
    }
    objectValues.set(key, newValue);
    console.log(`Updated ${objectNames.get(key)} to ${newValue}`);
    client.simpleAckResponse(request.header.sender, enums.ConfirmedServiceChoice.WRITE_PROPERTY, request.invokeId);
});

function sendAbort(receiver, invokeId) {
    const response = client._getBuffer(receiver && receiver.forwardedFrom);
    npdu.encode(response, enums.NpduControlPriority.NORMAL_MESSAGE, receiver);
    apdu.encodeAbort(response, enums.PduType.ABORT, invokeId, enums.AbortReason.SEGMENTATION_NOT_SUPPORTED);
    client.sendBvlc(receiver, response);
}

client.on('readProperty', request => {
    const { objectId, property } = request.payload;
    const { id: propertyId, index } = property;

    if (objectId.type !== enums.ObjectType.DEVICE || objectId.instance !== deviceId) {
        const value = propertyValue(objectId, propertyId);
        if (value) {
            client.readPropertyResponse(request.header.sender, request.invokeId, objectId, property,
                [value]);
        } else {
            client.errorResponse(request.header.sender, enums.ConfirmedServiceChoice.READ_PROPERTY,
                request.invokeId, enums.ErrorClass.PROPERTY, enums.ErrorCode.UNKNOWN_PROPERTY);
        }
        return;
    }

    const value = propertyValue(objectId, propertyId);
    if (value) {
        client.readPropertyResponse(request.header.sender, request.invokeId, objectId, property, [value]);
        return;
    }

    if (propertyId !== enums.PropertyIdentifier.OBJECT_LIST) {
        client.errorResponse(request.header.sender, enums.ConfirmedServiceChoice.READ_PROPERTY,
            request.invokeId, enums.ErrorClass.PROPERTY, enums.ErrorCode.UNKNOWN_PROPERTY);
        return;
    }

    console.log(`ReadProperty OBJECT_LIST arrayIndex=${index}`);
    if (index === enums.ASN1_ARRAY_ALL) {
        console.log('Rejected complete OBJECT_LIST read (simulated segmentationNotSupported).');
        sendAbort(request.header.sender, request.invokeId);
    } else if (index === 0) {
        client.readPropertyResponse(request.header.sender, request.invokeId, objectId, property,
            [{ type: enums.ApplicationTag.UNSIGNED_INTEGER, value: objects.length }]);
    } else if (Number.isInteger(index) && index > 0 && index <= objects.length) {
        const object = objects[index - 1];
        client.readPropertyResponse(request.header.sender, request.invokeId, objectId, property,
            [{ type: enums.ApplicationTag.OBJECTIDENTIFIER, value: object }]);
    } else {
        client.errorResponse(request.header.sender, enums.ConfirmedServiceChoice.READ_PROPERTY,
            request.invokeId, enums.ErrorClass.PROPERTY, enums.ErrorCode.INVALID_ARRAY_INDEX);
    }
});

client.on('listening', () => {
    console.log(`BACnet object-list simulator listening on ${host}:${port}`);
    console.log(`Device ID ${deviceId}; ${objects.length} analog/binary objects; complete OBJECT_LIST reads abort without segmentation.`);
    console.log(`Sample points: ${objects.slice(0, sampleObjects.length).map(object => object.name).join(', ')}`);
    console.log(`Sending I-Am announcements to ${announceTo}; FUXA's local BACnet port must differ from ${port}.`);
    const announce = () => client.iAmResponse({ address: announceTo }, deviceId, enums.Segmentation.NO_SEGMENTATION, 999);
    announce();
    const announcementTimer = setInterval(announce, 2000);
    announcementTimer.unref();
    client.once('close', () => clearInterval(announcementTimer));
});
client.on('error', error => console.error(`BACnet simulator error: ${error.message}`));

function shutdown() {
    client.close();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
