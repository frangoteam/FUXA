/**
 * Driver redis: client for Redis key/value and hash fields with polling and DAQ support
 */

'use strict';

let Redis; // resolved via require or via plugin manager if needed

const utils = require('../../utils');
const deviceUtils = require('../device-utils');

function tryLoadRedis(manager) {
    let mod = null;
    try { mod = require('redis'); } catch { /* not installed in root */ }
    if (!mod && manager) {
        try { mod = manager.require('redis'); } catch { /* not installed in _pkg */ }
    }
    return mod;
}

function RedisClient(_data, _logger, _events, _runtime) {
    // ---- runtime and configuration data
    let runtime = _runtime;                 // access to scripts, socketMutex, etc.
    let data = JSON.parse(JSON.stringify(_data)); // deep copy of device config
    const logger = _logger;
    const events = _events;

    // ---- connection and polling state
    let client = null;
    let lastStatus = '';                    // 'connect-ok' | 'connect-off' | 'connect-error' | 'connect-busy'
    let working = false;                    // avoid overload during polling/connection
    let overloading = 0;                    // overload counter
    let lastTimestampValue = null;          // timestamp of last successful polling
    let connected = false;

    const withTimeout = async (p, ms, label) => {
        const timeoutMs = ms || (data?.property?.redisTimeoutMs || 3000);
        let to;
        try {
            return await Promise.race([
                p,
                new Promise((_, rej) => { to = setTimeout(() => rej(new Error(`Timeout ${label || ''}`)), timeoutMs); })
            ]);
        } finally {
            clearTimeout(to);
        }
    };

    const hmgetCompat = async (cli, key, fields) => {
        if (typeof cli.hMGet === 'function') {
            try { return await cli.hMGet(key, ...fields); } catch (_) { /* fallthrough */ }
        }
        if (typeof cli.hmGet === 'function') {
            try { return await cli.hmGet(key, ...fields); } catch (_) { /* fallthrough */ }
        }
        return Promise.all(fields.map(f => cli.hGet(key, f)));
    };

    const getDeviceOptions = () => {
        const def = {
            readFields: { value: 'Value', quality: 'Quality', timestamp: 'UtcTimeMs' },
            maxKeysPerPoll: 500,
            redisTimeoutMs: 3000,
        };
        const opt = data?.property?.options;
        if (!opt) return def;
        if (typeof opt === 'string') { def.readFields.value = opt.trim() || def.readFields.value; return def; }
        if (opt.readFields) {
            def.readFields.value = opt.readFields.value || def.readFields.value;
            def.readFields.quality = opt.readFields.quality || def.readFields.quality;
            def.readFields.timestamp = opt.readFields.timestamp || def.readFields.timestamp;
        }
        if (typeof opt.maxKeysPerPoll === 'number') def.maxKeysPerPoll = opt.maxKeysPerPoll;
        if (typeof opt.redisTimeoutMs === 'number') def.redisTimeoutMs = opt.redisTimeoutMs;
        return def;
    };

    // ---- templating args per custom command
    const expandArgs = (tplArgs, ctx) => {
        const out = [];
        for (const a of (tplArgs || [])) {
            if (a === '{{key}}') out.push(ctx.key);
            else if (a === '{{fields...}}') out.push(...ctx.fields);
            else out.push(String(a));
        }
        return out;
    };

    // ---- normalizza result (array|object -> array allineata ai fields)
    const normalizeFieldValues = (res, fields) => {
        if (Array.isArray(res)) return res;
        if (res && typeof res === 'object') return fields.map(f => res[f]);
        if (res == null) return fields.map(() => undefined);
        return [String(res)];
    };

    // ---- utility chunk
    const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, (i + 1) * n));

    // ---- tags cache and mapping
    // varsValue: map { [tagId]: { id, value, type } }
    let varsValue = {};
    // keyMap: map tagId -> { kind: 'key'|'hash', key: string, field?: string, type, format, name }
    let keyMap = {};

    this.init = function () {
        // nothing to do for Redis
    };

    /**
     * Connect to Redis server
     */
    this.connect = function () {
        return new Promise(async (resolve, reject) => {
            try {
                if (!_checkWorking(true)) {
                    return reject();
                }
                logger.info(`'${data.name}' try to connect ${data?.property?.address || ''}`, true);

                if (!Redis) {
                    _emitStatus('connect-error');
                    _clearVarsValue();
                    _checkWorking(false);
                    return reject(new Error('redis module not found'));
                }

                client = await _buildRedisClient.call(this);
                await client.connect();

                connected = true;
                _emitStatus('connect-ok');
                logger.info(`'${data.name}' connected!`, true);
                _checkWorking(false);
                resolve();
            } catch (err) {
                connected = false;
                _emitStatus('connect-error');
                _clearVarsValue();
                _checkWorking(false);
                logger.error(`'${data.name}' connect failed! ${err}`);
                if (client) {
                    try { await client.quit(); } catch { }
                    client = null;
                }
                reject(err);
            }
        });
    };

    /**
     * Disconnect from Redis server
     */
    this.disconnect = function () {
        return new Promise(async (resolve) => {
            try {
                _checkWorking(false);
                if (client) {
                    try { await client.quit(); } catch { }
                }
            } catch (e) {
                logger.error(`'${data.name}' disconnect failure! ${e}`);
            } finally {
                client = null;
                connected = false;
                _emitStatus('connect-off');
                _clearVarsValue();
                resolve(true);
            }
        });
    };

    /**
     * Polling: read all configured keys in batch (MGET / HMGET)
     */
    this.polling = async function () {
        if (!_checkWorking(true)) {
            _emitStatus('connect-busy');
            return;
        }
        try {
            if (!client || !connected) {
                _checkWorking(false);
                return;
            }
            const readMode = (data?.property?.connectionOption || 'simple').toLowerCase();
            const batchResults = [];
            const timeoutMs = data?.property?.redisTimeoutMs || 3000;

            if (readMode === 'hash') {
                // Raggruppa i tag per chiave e deduplica i field richiesti per quella chiave
                const itemsByKey = new Map(); // key -> [{ tagId, field }]
                for (const tagId in keyMap) {
                    const km = keyMap[tagId];
                    if (km.kind !== 'hash') continue;
                    if (!itemsByKey.has(km.key)) itemsByKey.set(km.key, []);
                    itemsByKey.get(km.key).push({ tagId, field: km.field });
                }

                const keys = Array.from(itemsByKey.keys());
                const parts = chunk(keys, data?.property?.maxKeysPerPoll || 500);

                for (const part of parts) {
                    const results = await Promise.all(part.map(async (key) => {
                        const items = itemsByKey.get(key) || [];
                        const fields = Array.from(new Set(items.map(x => x.field)));
                        const vals = await withTimeout(
                            hmgetCompat(client, key, fields),
                            timeoutMs,
                            `HMGET ${key}`
                        ).catch(err => {
                            logger.warn(`HMGET ${key} failed: ${err?.message || err}`);
                            return new Array(fields.length);
                        });
                        return { key, fields, vals, items };
                    }));

                    for (const { fields, vals, items } of results) {
                        const byName = {};
                        fields.forEach((f, i) => { byName[f] = vals[i]; });
                        for (const { tagId, field } of items) {
                            batchResults.push({ tagId, raw: byName[field] });
                        }
                    }
                }
            } else {
                const keyReads = [];
                const hashGroups = new Map();

                for (const tagId in keyMap) {
                    const km = keyMap[tagId];
                    if (km.kind === 'hash') {
                        if (!hashGroups.has(km.key)) hashGroups.set(km.key, []);
                        hashGroups.get(km.key).push({ tagId, field: km.field });
                    } else {
                        keyReads.push({ tagId: tagId, key: km.key });
                    }
                }

                if (keyReads.length) {
                    const keys = keyReads.map(x => x.key);
                    const values = await withTimeout(client.mGet(keys), timeoutMs, 'MGET');
                    for (let i = 0; i < keyReads.length; i++) {
                        batchResults.push({ tagId: keyReads[i].tagId, raw: values[i] });
                    }
                }

                for (const [hashKey, items] of hashGroups.entries()) {
                    const fields = items.map(x => x.field);
                    const aVals = await withTimeout(hmgetCompat(client, hashKey, fields), timeoutMs, `HMGET ${hashKey}`);
                    for (let i = 0; i < items.length; i++) {
                        batchResults.push({ tagId: items[i].tagId, raw: aVals[i] });
                    }
                }
            }
            const changed = await _updateVarsValue(batchResults);
            lastTimestampValue = Date.now();
            _emitValues(varsValue);
            if (this.addDaq && !utils.isEmptyObject(changed)) {
                this.addDaq(changed, data.name, data.id);
            }

            if (lastStatus !== 'connect-ok') {
                _emitStatus('connect-ok');
            }
        } catch (err) {
            logger.error(`'${data.name}' polling error: ${err}`);
        } finally {
            _checkWorking(false);
        }
    };

    /**
     * Load: map tags into key/hash definition
     * - tag.address = redis key
     */
    this.load = function (_data) {
        varsValue = {};
        data = JSON.parse(JSON.stringify(_data));
        keyMap = {};
        try {
            const readMode = (data?.property?.connectionOption || 'simple').toLowerCase();
            const isHashLike = (readMode === 'hash');
            const deviceValueField = getDeviceOptions().readFields.value;

            const tags = data?.tags || {};
            const count = Object.keys(tags).length;

            for (const id in tags) {
                const tag = tags[id];

                // In 'simple' leggiamo string keys (MGET); in 'hash' e 'custom' leggiamo hash fields
                const kind = isHashLike ? 'hash' : 'key';

                // Campo da leggere per i tag hash:
                // - se il tag ha options string non vuota -> e il nome del field
                // - altrimenti si usa il default device (readFields.value)
                const tagField = isHashLike
                    ? ((typeof tag?.options === 'string' && tag.options.trim())
                        ? tag.options.trim()
                        : deviceValueField)
                    : undefined;

                const entry = {
                    kind,
                    key: String(tag.address || tag.name || id),
                    field: (kind === 'hash') ? String(tagField) : undefined,
                    type: tag.type,
                    format: tag.format,
                    name: tag.name
                };
                keyMap[id] = entry;
            }

            logger.info(`'${data.name}' data loaded (${count})`, true);
        } catch (err) {
            logger.error(`'${data.name}' load error! ${err}`);
        }
    };

    /**
     * getValues: return the full cache
     */
    this.getValues = function () {
        return varsValue;
    };

    /**
     * getValue: return { id, value, ts } for one tag
     */
    this.getValue = function (id) {
        if (varsValue[id]) {
            return { id, value: varsValue[id].value, ts: lastTimestampValue };
        }
        return null;
    };

    /**
     * getStatus: return current connection status
     */
    this.getStatus = function () {
        return lastStatus;
    };

    /**
     * Return tag property for frontend
     */
    this.getTagProperty = function (tagId) {
        if (data.tags[tagId]) {
            const t = data.tags[tagId];
            return { id: tagId, name: t.name, type: t.type, format: t.format };
        }
        return null;
    };

    /**
     * setValue: write SET / HSET
     */
    this.setValue = async function (tagId, value) {
        if (!client || !connected) {
            return false;
        }
        const tag = data.tags[tagId];
        const km = keyMap[tagId];
        if (!tag || !km) {
            return false;
        }

        let raw = await deviceUtils.tagRawCalculator(value, tag, runtime);
        if (tag.type === 'boolean') raw = !!raw ? '1' : '0';
        else if (tag.type === 'number') {
            // normalize: "123,45" and "123.45"
            let s = String(raw).replace(',', '.');
            const n = Number(s);
            if (!Number.isFinite(n)) {
                logger.warn(`'${tag.name}' setValue rejected: NaN`);
                return false;
            }
            raw = String(n);
        } else {
            raw = String(raw ?? '');
        }

        const timeoutMs = data?.property?.redisTimeoutMs || 3000;
        const ttlSeconds = data?.property?.ttlSeconds ?? 0;
        const isHashMode = (data?.property?.connectionOption || 'simple').toLowerCase() === 'hash';
        const writeMeta = !!(data?.property?.writeMeta && isHashMode);

        try {
            if (km.kind === 'hash') {
                await withTimeout(client.hSet(km.key, km.field, raw), timeoutMs, `HSET meta ${km.key}`);
                if (ttlSeconds > 0) await withTimeout(client.expire(km.key, ttlSeconds), timeoutMs, `EXPIRE ${km.key}`);
            } else {
                if (ttlSeconds > 0) await withTimeout(client.set(km.key, raw, { EX: ttlSeconds }), timeoutMs, `SETEX ${km.key}`);
                else await withTimeout(client.set(km.key, raw), timeoutMs, `SET ${km.key}`);
            }

            logger.info(`'${tag.name}' setValue(${tagId}, ${raw})`, true, true);
            return true;
        } catch (err) {
            logger.error(`'${tag?.name || tagId}' setValue error: ${err?.message || err}`);
            return false;
        }
    };

    this.isConnected = function () {
        return !!connected;
    };

    // DAQ binder
    this.bindAddDaq = function (fnc) {
        this.addDaq = fnc;
    };
    this.addDaq = null;

    // last read timestamp
    this.lastReadTimestamp = () => lastTimestampValue;

    // security binder
    this.bindGetProperty = function (fnc) {
        this.getProperty = fnc;
    };
    this.getProperty = null;

    // optional: DAQ settings
    this.getTagDaqSettings = (tagId) => data.tags?.[tagId]?.daq || null;
    this.setTagDaqSettings = (tagId, settings) => {
        if (data.tags?.[tagId]) {
            utils.mergeObjectsValues(data.tags[tagId].daq, settings);
        }
    };


    var _clearVarsValue = function () {
        for (let id in varsValue) {
            varsValue[id].value = null;
        }
        _emitValues(varsValue);
    }

    /**
     * Update the Tags values (compose + DAQ) following the standard FUXA pattern.
     * @param {Array<{tagId:string, raw:any}>} batch
     * @returns {Object|null} DAQ map { [id]: tagObj } or null if nothing relevant
     */
    var _updateVarsValue = async (batch) => {
        let hasAny = false;
        const tempTags = {};

        // 1) build tempTags with rawValue and changed flag
        for (const item of batch) {
            const id = item.tagId;
            const tag = data.tags[id];
            if (!tag) {
                continue;
            }

            const prevRaw = varsValue[id]?.rawValue;
            const rawValue = item.raw;
            const changed = prevRaw !== rawValue;

            tempTags[id] = {
                id,
                rawValue,
                type: tag.type,
                daq: tag.daq,
                changed,
                tagref: tag
            };
            hasAny = true;
        }

        if (!hasAny) {
            return null;
        }

        // 2) compose value (scale/scripts/deadband/format) + DAQ decision
        const timestamp = Date.now();
        const result = {};
        for (const id in tempTags) {
            const t = tempTags[id];
            if (!utils.isNullOrUndefined(t.rawValue)) {
                // parse raw -> typed
                const parsed = deviceUtils.parseValue(t.rawValue, t.tagref?.type);

                // compose: script/scale/deadband/format
                t.value = await deviceUtils.tagValueCompose(
                    parsed,
                    varsValue[id] ? varsValue[id].value : null,
                    t.tagref,
                    runtime
                );

                t.timestamp = timestamp;

                // DAQ decision
                if (this.addDaq && deviceUtils.tagDaqToSave(t, timestamp)) {
                    result[id] = t;
                }
            }
            // cache (keep raw + reset changed)
            varsValue[id] = t;
            varsValue[id].changed = false;
        }

        return Object.keys(result).length ? result : null;
    }

    var _emitValues = function (values) {
        // send all current values to frontend
        events.emit('device-value:changed', { id: data.id, values: values });
    }

    var _emitStatus = function (status) {
        lastStatus = status;
        events.emit('device-status:changed', { id: data.id, status });
    }

    var _checkWorking = function (flag) {
        if (flag) {
            if (working) {
                if (++overloading > 3) {
                    _emitStatus('connect-busy');
                    overloading = 0;
                }
                logger.warn(`'${data.name}' working (connection || polling) overload! ${overloading}`);
                return false;
            }
            working = true;
            return true;
        } else {
            working = false;
            return true;
        }
    }

    /**
     * Build a redis client using node-redis v4
     * - data.property.address: host or URL
     * - data.property.port: optional
     * - security options: via bindGetProperty({query:'security',name:data.id})
     */
    var _buildRedisClient = async () => {
        const address = data?.property?.address || '127.0.0.1';
        const port = data?.property?.port ? `:${data.property.port}` : '';
        let url;

        if (address.startsWith('redis://') || address.startsWith('rediss://')) {
            url = address;
        } else {
            url = `redis://${address}${port}`;
        }

        // optional: security property with uid/pwd/tls
        try {
            if (this.getProperty) {
                const sec = await this.getProperty({ query: 'security', name: data.id });
                if (sec && sec.value && sec.value !== 'null') {
                    const prop = JSON.parse(sec.value);
                    if (prop.pwd || prop.uid) {
                        const u = encodeURIComponent(prop.uid || '');
                        const p = encodeURIComponent(prop.pwd || '');
                        const proto = (url.startsWith('rediss://')) ? 'rediss' : 'redis';
                        const hostPart = url.replace(/^redis[s]?:\/\//, '');
                        const auth = prop.uid ? `${u}:${p}@` : `:${p}@`;
                        url = `${proto}://${auth}${hostPart}`;
                    }
                    if (prop.tls === true && !url.startsWith('rediss://')) {
                        url = url.replace(/^redis:\/\//, 'rediss://');
                    }
                }
            }
        } catch (e) {
            logger.warn(`'${data.name}' security property parse warning: ${e}`);
        }

        const cli = Redis.createClient({
            url,
            autoPipelining: true,
            socket: {
                reconnectStrategy: (retries) => Math.min(100 + retries * 200, 3000)
            }
        });

        cli.on('ready', () => {
            connected = true;
            _emitStatus('connect-ok');
            logger.info(`'${data.name}' redis ready`, true);
        });

        cli.on('end', () => {
            connected = false;
            _emitStatus('connect-off');
            logger.warn(`'${data.name}' redis connection closed`);
        });

        cli.on('error', (err) => {
            logger.error(`'${data.name}' redis error: ${err}`);
        });
        return cli;
    }
}

module.exports = {
    init: function () { },
    create: function (data, logger, events, manager, runtime) {
        if (!Redis) {
            Redis = tryLoadRedis(manager);
        }
        if (!Redis) {
            return null;
        }
        return new RedisClient(data, logger, events, runtime);
    }
};
