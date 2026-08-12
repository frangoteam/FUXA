/**
 * FUXA device plugin for PLUM ecoMAX controllers exposed by econext-gateway.
 * The gateway owns the physical RS-485 communication; this plugin translates
 * its REST resources into FUXA tags, browse nodes and write operations.
 */
'use strict';

const axios = require('axios');

// DataType codes exposed by the gateway in GET /api/parameters.  FUXA has
// only number/boolean/string tag types, so the protocol-specific constraints
// are retained here and applied before POST /api/parameters/{name}.
const ECONEXT_DATA_TYPES = {
    1: { name: 'int8', fuxaType: 'number', integer: true, min: -128, max: 127 },
    2: { name: 'int16', fuxaType: 'number', integer: true, min: -32768, max: 32767 },
    3: { name: 'int32', fuxaType: 'number', integer: true, min: -2147483648, max: 2147483647 },
    4: { name: 'uint8', fuxaType: 'number', integer: true, min: 0, max: 255 },
    5: { name: 'uint16', fuxaType: 'number', integer: true, min: 0, max: 65535 },
    6: { name: 'uint32', fuxaType: 'number', integer: true, min: 0, max: 4294967295 },
    7: { name: 'float', fuxaType: 'number' },
    9: { name: 'double', fuxaType: 'number' },
    10: { name: 'bool', fuxaType: 'boolean' },
    12: { name: 'string', fuxaType: 'string' },
    // JSON numbers outside the safe JavaScript integer range lose precision.
    13: { name: 'int64', fuxaType: 'number', integer: true, min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER },
    14: { name: 'uint64', fuxaType: 'number', integer: true, min: 0, max: Number.MAX_SAFE_INTEGER }
};

function PlumEconextGatewayClient(_data, logger, events, runtime) {
    let data = clone(_data);
    let connected = false;
    let working = false;
    let lastStatus = 'connect-off';
    let lastTimestampValue = 0;
    // Tag ids are GUID-like strings, therefore values must be a plain map.
    let values = {};
    let parameters = {};
    let lastWriteResult = null;

    const baseUrl = () => String(data.property.address || '').replace(/\/$/, '');
    const parametersUrl = () => `${baseUrl()}/api/parameters`;

    function clone(value) { return JSON.parse(JSON.stringify(value)); }

    function emitStatus(status) {
        connected = status === 'connect-ok';
        if (status !== lastStatus) {
            lastStatus = status;
            events.emit('device-status:changed', { id: data.id, status });
        }
    }

    function dataType(parameter) {
        return ECONEXT_DATA_TYPES[Number(parameter.type)];
    }

    function parameterType(parameter) {
        const descriptor = dataType(parameter);
        if (descriptor) return descriptor.fuxaType;
        if (typeof parameter.value === 'boolean') return 'boolean';
        if (typeof parameter.value === 'number') return 'number';
        return 'string';
    }

    function coerceWriteValue(value, parameter) {
        const descriptor = dataType(parameter);
        const type = descriptor?.fuxaType || parameterType(parameter);

        if (type === 'boolean') {
            if (value === true || value === false) return value;
            if (value === 1 || String(value).trim().toLowerCase() === 'true' || String(value).trim() === '1') return true;
            if (value === 0 || String(value).trim().toLowerCase() === 'false' || String(value).trim() === '0') return false;
            throw new Error(`Invalid boolean value for '${parameter.name}'`);
        }
        if (type === 'string') return String(value);

        const output = Number(value);
        if (!Number.isFinite(output)) throw new Error(`Invalid numeric value for '${parameter.name}'`);
        if (descriptor?.integer && !Number.isInteger(output)) {
            throw new Error(`Value for '${parameter.name}' must be an integer (${descriptor.name})`);
        }
        if (descriptor?.min != null && output < descriptor.min) {
            throw new Error(`Value for '${parameter.name}' is below ${descriptor.name} minimum ${descriptor.min}`);
        }
        if (descriptor?.max != null && output > descriptor.max) {
            throw new Error(`Value for '${parameter.name}' is above ${descriptor.name} maximum ${descriptor.max}`);
        }
        return output;
    }

    function parameterGroup(parameter) {
        if (parameter.group) return String(parameter.group);
        const name = String(parameter.name || 'Other');
        const separated = name.match(/^([^_]+)_/);
        if (separated) return separated[1];
        const camelCase = name.match(/^([A-Z]+(?=[A-Z][a-z])|[A-Z]?[a-z]+)/);
        return camelCase ? camelCase[1] : 'Other';
    }

    async function readParameters() {
        const response = await axios.get(parametersUrl(), {
            timeout: Number(data.property.timeout) || 5000
        });
        parameters = response.data?.parameters || {};
        return parameters;
    }

    function findParameter(tag) {
        return Object.values(parameters).find(parameter =>
            String(parameter.index) === String(tag.address) || parameter.name === tag.address);
    }

    function shouldSaveDaq(item, timestamp) {
        const daq = item.daq;
        if (!daq || (!daq.enabled && !daq.restored)) return false;
        item.timestamp = timestamp;
        if (item.changed && (daq.changed || daq.restored)) return true;
        if (!daq.lastDaqSaved || (daq.interval && timestamp - Number(daq.interval) * 1000 > daq.lastDaqSaved)) {
            daq.lastDaqSaved = timestamp;
            return true;
        }
        return false;
    }

    async function composeValue(value, previous, tag) {
        if (tag.scaleReadFunction && runtime?.scriptsMgr) {
            value = await runtime.scriptsMgr.runScript({
                id: tag.scaleReadFunction,
                parameters: [{ name: 'value', type: 'value', value }],
                notLog: true
            }, false);
        }
        if (typeof value === 'number' && tag.scale?.mode === 'linear') {
            value = (tag.scale.scaledHigh - tag.scale.scaledLow) *
                (value - tag.scale.rawLow) / (tag.scale.rawHigh - tag.scale.rawLow) + tag.scale.scaledLow;
        }
        if (typeof value === 'number' && tag.deadband?.value && previous != null &&
            Math.abs(value - previous) <= tag.deadband.value) value = previous;
        if (typeof value === 'number' && tag.format) value = Number(value.toFixed(tag.format));
        return value;
    }

    async function rawValue(value, tag) {
        if (tag.scale?.mode === 'linear') {
            value = tag.scale.rawLow + (tag.scale.rawHigh - tag.scale.rawLow) *
                (value - tag.scale.scaledLow) / (tag.scale.scaledHigh - tag.scale.scaledLow);
        }
        if (tag.scaleWriteFunction && runtime?.scriptsMgr) {
            value = await runtime.scriptsMgr.runScript({
                id: tag.scaleWriteFunction,
                parameters: [{ name: 'value', type: 'value', value }],
                notLog: true
            }, false);
        }
        return value;
    }

    this.connect = async function () {
        if (!baseUrl()) {
            emitStatus('connect-failed');
            throw new Error('PLUM ecoNEXT Gateway address is missing');
        }
        try {
            await readParameters();
            emitStatus('connect-ok');
        } catch (error) {
            emitStatus('connect-error');
            throw error;
        }
    };

    this.disconnect = async function () {
        working = false;
        values = {};
        emitStatus('connect-off');
        events.emit('device-value:changed', { id: data.id, values });
    };

    this.isConnected = () => connected;
    this.lastReadTimestamp = () => lastTimestampValue;
    this.getStatus = () => lastStatus;
    this.getValues = () => values;
    this.getLastWriteResult = () => lastWriteResult;
    this.bindAddDaq = function (fnc) { this.addDaq = fnc; };
    this.addDaq = null;

    this.load = function (_data) {
        data = clone(_data);
        values = {};
    };

    this.polling = async function () {
        if (working) return;
        working = true;
        try {
            await readParameters();
            const timestamp = Date.now();
            const changed = {};
            for (const tagId in data.tags) {
                const tag = data.tags[tagId];
                const parameter = findParameter(tag);
                if (!parameter) continue;
                const previous = values[tagId]?.value ?? null;
                const value = await composeValue(parameter.value, previous, tag);
                const item = { id: tagId, value, timestamp, daq: tag.daq, changed: !!values[tagId] && previous !== value };
                values[tagId] = item;
                if (this.addDaq && shouldSaveDaq(item, timestamp)) changed[tagId] = item;
                item.changed = false;
            }
            lastTimestampValue = timestamp;
            events.emit('device-value:changed', { id: data.id, values });
            if (this.addDaq && Object.keys(changed).length) this.addDaq(changed, data.name, data.id);
            emitStatus('connect-ok');
        } catch (error) {
            logger.error(`'${data.name}' PLUM ecoNEXT Gateway polling error: ${error.message || error}`);
            emitStatus('connect-error');
        } finally {
            working = false;
        }
    };

    this.getValue = function (tagId) {
        return values[tagId] ? { id: tagId, value: values[tagId].value, ts: lastTimestampValue } : null;
    };

    this.getTagProperty = function (tagId) {
        const tag = data.tags[tagId];
        return tag ? { id: tagId, name: tag.name, type: tag.type, format: tag.format } : null;
    };

    this.setValue = async function (tagId, value) {
        const tag = data.tags[tagId];
        if (!tag) return false;
        const parameter = findParameter(tag);
        if (!parameter?.writable) {
            logger.warn(`'${data.name}' parameter '${tag.name}' is read-only`);
            return false;
        }
        let output = await rawValue(value, tag);
        const type = parameterType(parameter);
        output = coerceWriteValue(output, parameter);
        if (type === 'number' && parameter.min != null && output < parameter.min) throw new Error(`Value for '${parameter.name}' is below minimum ${parameter.min}`);
        if (type === 'number' && parameter.max != null && output > parameter.max) throw new Error(`Value for '${parameter.name}' is above maximum ${parameter.max}`);
        let response;
        try {
            response = await axios.post(`${parametersUrl()}/${encodeURIComponent(parameter.name)}`, { value: output }, {
                timeout: Number(data.property.timeout) || 5000
            });
            lastWriteResult = {
                timestamp: Date.now(), parameter: parameter.name, index: parameter.index,
                requestedValue: output, status: response.status || 200, response: response.data
            };
        } catch (error) {
            lastWriteResult = {
                timestamp: Date.now(), parameter: parameter.name, index: parameter.index,
                requestedValue: output, status: error.response?.status,
                response: error.response?.data, error: error.message || String(error)
            };
            throw error;
        }
        if (response.data?.success === false) return false;
        const timestamp = Date.now();
        values[tagId] = { id: tagId, value: await composeValue(output, values[tagId]?.value, tag), timestamp, daq: tag.daq, changed: false };
        lastTimestampValue = timestamp;
        events.emit('device-value:changed', { id: data.id, values });
        return true;
    };

    /** Return a group/parameter tree compatible with the FUXA BACnet browser. */
    this.browse = async function (node) {
        await readParameters();
        if (!node) {
            return [...new Set(Object.values(parameters).map(parameterGroup))].sort()
                .map(group => ({ id: group, name: group, class: 'Object' }));
        }
        const search = node.search != null ? String(node.search).trim().toLowerCase() : null;
        const allParameters = Object.values(parameters);
        let matching = allParameters.filter(parameter => {
            if (search != null) {
                return String(parameter.index).toLowerCase().includes(search) ||
                    String(parameter.name).toLowerCase().includes(search);
            }
            return parameterGroup(parameter) === node.id;
        });
        // A numeric query is normally an exact gateway index. Prefer the exact
        // record when it exists instead of returning indices that merely contain it.
        if (search != null && /^\d+$/.test(search)) {
            const exact = allParameters.filter(parameter => String(parameter.index) === search);
            if (exact.length) matching = exact;
        }
        const indexDirection = node.sort === 'desc' ? -1 : 1;
        return matching
            .sort((a, b) => {
                const aIndex = Number(a.index);
                const bIndex = Number(b.index);
                if (Number.isFinite(aIndex) && Number.isFinite(bIndex) && aIndex !== bIndex) {
                    return (aIndex - bIndex) * indexDirection;
                }
                return String(a.name).localeCompare(String(b.name)) * indexDirection;
            })
            .map(parameter => ({
                id: String(parameter.index), name: parameter.name, class: 'Variable',
                type: parameterType(parameter), writable: !!parameter.writable,
                unit: parameter.unit, min: parameter.min, max: parameter.max,
                econextType: parameter.type,
                econextTypeName: dataType(parameter)?.name
            }));
    };
}

module.exports = {
    create(data, logger, events, runtime) {
        return new PlumEconextGatewayClient(data, logger, events, runtime);
    }
};
