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
            try {
                return await cli.hMGet(key, fields);
            } catch (_) { /* fallthrough */ }
        }
        if (typeof cli.hmGet === 'function') {
            try {
                return await cli.hmGet(key, fields);
            } catch (_) { /* fallthrough */ }
        }
        return await cli.sendCommand(['HMGET', key, ...fields.map(String)]);
    };

    const getDeviceOptions = () => {
        const def = {
            readFields: { value: 'Value', quality: 'Quality', timestamp: 'UtcTimeMs' },
            maxKeysPerPoll: 500,
            redisTimeoutMs: 3000,
        };
        const opt = data?.property?.options;
        if (!opt) {
            return def;
        }
        if (typeof opt === 'string') {
            def.readFields.value = opt.trim() || def.readFields.value;
            return def;
        }
        if (opt.readFields) {
            def.readFields.value = opt.readFields.value || def.readFields.value;
            def.readFields.quality = opt.readFields.quality || def.readFields.quality;
            def.readFields.timestamp = opt.readFields.timestamp || def.readFields.timestamp;
        }
        if (typeof opt.maxKeysPerPoll === 'number') {
            def.maxKeysPerPoll = opt.maxKeysPerPoll;
        }
        if (typeof opt.redisTimeoutMs === 'number') {
            def.redisTimeoutMs = opt.redisTimeoutMs;
        }
        return def;
    };

    // ---- templating args per custom command
    const expandArgs = (tplArgs, ctx) => {
        const out = [];
        for (const a of (tplArgs || [])) {
            if (a === '{{key}}') {
                out.push(ctx.key);
            }
            else if (a === '{{fields...}}') {
                out.push(...ctx.fields);
            }
            else {
                out.push(String(a));
            }
        }
        return out;
    };

    // ---- normalize result (array|object -> array aligned to fields)
    const normalizeFieldValues = (res, fields) => {
        if (Array.isArray(res)) {
            return res;
        }
        if (res && typeof res === 'object') {
            return fields.map(f => res[f]);
        }
        if (res == null) {
            return fields.map(() => undefined);
        }
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
            const deviceFields = getDeviceOptions().readFields; // { value, quality, timestamp }

            if (readMode === 'hash') {
                // Group tags by key and deduplicate the fields required for that key.
                const itemsByKey = new Map(); // key -> [{ tagId, field }]
                for (const tagId in keyMap) {
                    const km = keyMap[tagId];
                    if (km.kind !== 'hash') {
                        continue;
                    }
                    if (!itemsByKey.has(km.key)) {
                        itemsByKey.set(km.key, []);
                    }
                    itemsByKey.get(km.key).push({ tagId, field: km.field });
                }

                const keys = Array.from(itemsByKey.keys());
                const parts = chunk(keys, data?.property?.maxKeysPerPoll || 500);

                for (const part of parts) {
                    const results = await Promise.all(part.map(async (key) => {
                        const items = itemsByKey.get(key) || [];
                        const fields = Array.from(new Set([
                            ...items.map(x => x.field),
                            deviceFields?.timestamp,
                            deviceFields?.quality
                        ].filter(Boolean)));
                        const valsRaw = await withTimeout(
                            hmgetCompat(client, key, fields),
                            timeoutMs,
                            `HMGET ${key}`
                        ).catch(err => {
                            logger.warn(`HMGET ${key} failed: ${err?.message || err}`);
                            return new Array(fields.length);
                        });
                        const vals = normalizeFieldValues(valsRaw, fields);
                        return { key, fields, vals, items };
                    }));

                    for (const { fields, vals, items } of results) {
                        const byName = {};
                        fields.forEach((f, i) => { byName[f] = vals[i]; });
                        const metaTs = deviceFields?.timestamp ? byName[deviceFields.timestamp] : undefined;
                        const metaQ = deviceFields?.quality ? byName[deviceFields.quality] : undefined;
                        for (const { tagId, field } of items) {
                            batchResults.push({ tagId, raw: byName[field], metaTs, metaQ });
                        }
                    }
                }
            } else {
                const keyReads = [];
                const hashGroups = new Map();

                for (const tagId in keyMap) {
                    const km = keyMap[tagId];
                    if (km.kind === 'hash') {
                        if (!hashGroups.has(km.key)) {
                            hashGroups.set(km.key, []);
                        }
                        hashGroups.get(km.key).push({ tagId, field: km.field });
                    } else {
                        keyReads.push({ tagId: tagId, key: km.key });
                    }
                }

                if (keyReads.length) {
                    const ids = keyReads.map(x => x.tagId);
                    const keys = keyReads.map(x => x.key);
                    const parts = chunk(keys, data?.property?.maxKeysPerPoll || 500);
                    let ofs = 0;
                    for (const part of parts) {
                        const vals = await withTimeout(client.mGet(part), timeoutMs, 'MGET');
                        for (let i = 0; i < part.length; i++, ofs++) {
                            batchResults.push({ tagId: ids[ofs], raw: vals[i] });
                        }
                    }
                }

                for (const [hashKey, items] of hashGroups.entries()) {
                    const fields = Array.from(new Set([
                        ...items.map(x => x.field),
                        deviceFields?.timestamp,
                        deviceFields?.quality
                    ].filter(Boolean)));

                    const valsRaw = await withTimeout(
                        hmgetCompat(client, hashKey, fields),
                        timeoutMs,
                        `HMGET ${hashKey}`
                    );
                    const vals = normalizeFieldValues(valsRaw, fields);

                    const byName = {};
                    fields.forEach((f, idx) => { byName[f] = vals[idx]; });

                    const metaTs = deviceFields?.timestamp ? byName[deviceFields.timestamp] : undefined;
                    const metaQ = deviceFields?.quality ? byName[deviceFields.quality] : undefined;

                    for (const { tagId, field } of items) {
                        batchResults.push({ tagId, raw: byName[field], metaTs, metaQ });
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
            logger.error(`'${data.name}' polling error: ${err?.message || err}`);
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

                // In 'simple' read string keys (MGET); in 'hash' and 'custom' read hash fields
                const kind = isHashLike ? 'hash' : 'key';

                // Field to read for hash tags:
                // - if the tag has a non-empty options string -> and the name of the field
                // - otherwise, the default device is used (readFields.value)
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
            const t = varsValue[id];
            return { id, value: t.value, ts: t.timestamp ?? lastTimestampValue };
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
     * Write modes:
     * - Default: HSET/SET (sample-compat)
     * - Command mode: write.name set (e.g., DAINSY.HSET)
     *   * pairs mode: args as {name,value} or ["Field","{{token}}", ...]
     *   * full argv: args already include {{key}}, {{history}}, {{field}}, {{value}}, ...
     */
    this.setValue = async function (tagId, value) {
        if (!client || !connected) {
            return false;
        }
        try {
            // 1) Resolve mapping/tags
            const km = keyMap[tagId];
            if (!km || !km.key) {
                throw new Error(`unknown-tag ${tagId}`);
            }
            const tag = data?.tags?.[tagId];

            // 2) Device options
            const timeoutMs = data?.property?.redisTimeoutMs || 3000;
            const ttlSeconds = data?.property?.ttlSeconds ?? 0;
            const readMode = (data?.property?.connectionOption || 'simple').toLowerCase();
            const isHash = readMode === 'hash';

            // 3) Normalise payload (supports primitive, JSON string, object)
            let payload = { value };
            if (typeof value === 'string') {
                try {
                    const parsed = JSON.parse(value);
                    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                        payload = parsed;
                    }
                } catch { /* result { value: string } */ }
            } else if (value && typeof value === 'object' && !Buffer.isBuffer(value)) {
                payload = value;
            }

            // 4) Pick helper
            const pick = (obj, names) => {
                for (const n of names) {
                    if (obj[n] !== undefined) {
                        return obj[n];
                    }
                }
                return undefined;
            };

            // 5) Main field (hash only) and input value
            const deviceValueField = getDeviceOptions().readFields?.value || 'Value';
            const mainValueInput = pick(payload, ['value', 'Value', 'val', 'Val']) ?? payload;
            const fieldOverride = pick(payload, ['field', 'Field']);
            const mainField = isHash ? String(fieldOverride || km.field || deviceValueField) : undefined;

            // 6) Calculate RAW with FUXA logic and normalise by tag type
            let raw = await deviceUtils.tagRawCalculator(mainValueInput, tag, runtime);
            if (tag?.type === 'boolean') {
                raw = raw ? '1' : '0';
            } else if (tag?.type === 'number') {
                const str = String(raw).replace(',', '.');
                const num = Number(str);
                if (!Number.isFinite(num)) {
                    logger.warn(`'${tag?.name || tagId}' setValue rejected: NaN`);
                    return false;
                }
                raw = String(num);
            } else {
                raw = String(raw ?? '');
            }
            const mainValue = raw;

            // 7) Optional targets from payload (only these three, no extras)
            const quality = pick(payload, ['quality', 'Quality', 'qual', 'Qual']);
            const timestamp = pick(payload, ['timestamp', 'Timestamp', 'utcTimeMs', 'UtcTimeMs']);
            const provider = pick(payload, ['provider', 'Provider']);
            const history = pick(payload, ['history', 'History', 'hist', 'Hist']);

            // 8) Dynamic writing configuration (frontend)
            const opts = data?.property?.options || {};
            const write = opts?.customCommand?.write || {};
            const cmdName = (write?.name || '').trim();                // es. "DAINSY.HSET" or ""
            const writeArgsRaw = Array.isArray(write?.args) ? write.args : [];
            if (Array.isArray(writeArgsRaw) && writeArgsRaw.some(x => x == null)) {
                logger.warn(`'${data.name}' write.args contains null/undefined entries — ignored`);
            }
            const writeArgs = normalizeWriteArgs(writeArgsRaw);

            // 9) Placeholder context (known tokens only)
            const tokenCtx = {
                key: km.key,
                field: mainField,
                value: mainValue,
                quality,
                timestamp,
                provider,
                history,
            };

            // 10) COMMAND MODE: if write.name
            if (cmdName) {
                // used:
                //  A) argv complete in args (already with key/history/field/value)
                //  B) pairs (field, value), including ‘history’:<n> which becomes a positional argument
                const expanded = expandTokens(writeArgs, tokenCtx);

                // complete argv if the first argument resembles the key
                const looksLikeFullArgv =
                    expanded.length > 0 && (expanded[0] === km.key || expanded[0].includes(':'));

                if (looksLikeFullArgv) {
                    const argv = [cmdName, ...expanded];
                    await withTimeout(client.sendCommand(argv), timeoutMs, `${cmdName} ...`);
                    return true;
                }

                // Pairs mode: extract history, the rest remains HSET pairs
                const histSize = Number(history) || 100; // default 100
                const pairs = [];
                for (let i = 0; i < expanded.length; i += 2) {
                    const k = expanded[i];
                    const v = expanded[i + 1];
                    if (k == null) {
                        continue;
                    }
                    if (String(k).toLowerCase() === 'history') {
                        continue;
                    }
                    pairs.push(String(k), v == null ? '' : String(v));
                }

                const argv = [cmdName, km.key, String(histSize), mainField, String(mainValue), ...pairs];
                await withTimeout(client.sendCommand(argv), timeoutMs, `${cmdName} ...`);
                return true;
            }

            // 11) DEFAULT (not write.name): compatible with the sample
            if (isHash) {
                const argv = ['HSET', km.key, mainField, String(mainValue)];

                // If you have configured pairs in write.args (without name), append them as they are.
                if (writeArgs.length > 0) {
                    const expanded = expandTokens(writeArgs, tokenCtx);
                    for (let i = 0; i < expanded.length; i += 2) {
                        const k = expanded[i];
                        const v = expanded[i + 1];
                        if (k == null) {
                            continue;
                        }
                        argv.push(String(k), v == null ? '' : String(v));
                    }
                } else {
                    // No configuration: only use meta tags present in the payload (as in the sample)
                    if (quality !== undefined) {
                        argv.push('Quality', String(quality));
                    }
                    if (timestamp !== undefined) {
                        argv.push('UtcTimeMs', String(timestamp));
                    }
                    if (provider !== undefined) {
                        argv.push('Provider', String(provider));
                    }
                }

                await withTimeout(client.sendCommand(argv), timeoutMs, `HSET ${km.key}`);
                if (ttlSeconds > 0) {
                    await withTimeout(
                        client.sendCommand(['EXPIRE', km.key, String(ttlSeconds)]),
                        timeoutMs,
                        `EXPIRE ${km.key}`,
                    );
                }
            } else {
                // SIMPLE: SET (like sample), with EX optional
                if (ttlSeconds > 0) {
                    await withTimeout(
                        client.sendCommand(['SET', km.key, String(mainValue), 'EX', String(ttlSeconds)]),
                        timeoutMs,
                        `SET ${km.key} EX ${ttlSeconds}`,
                    );
                } else {
                    await withTimeout(
                        client.sendCommand(['SET', km.key, String(mainValue)]),
                        timeoutMs,
                        `SET ${km.key}`,
                    );
                }
            }
            return true;
        } catch (err) {
            logger.error(`'${tag?.name || tagId}' setValue error: ${err?.message || err}`);
            return false;
        }
    };

    var expandTokens = (arr, ctx) => {
        return (arr || []).map((x) => {
            if (typeof x !== 'string') return x == null ? '' : String(x);
            return x.replace(/\{\{([\w.\-]+)\}\}/g, (_, kRaw) => {
                const k = String(kRaw);
                let v = ctx[k];

                // Automatic fallbacks for known tokens
                if (v == null) {
                    switch (k.toLowerCase()) {
                        case 'timestamp':
                        case 'utctimems':
                        case 'now':
                        case 'nowms':
                            v = Date.now();
                            break;
                        case 'provider':
                            v = 'app-fuxa';
                            break;
                        case 'quality':
                            v = 0;
                            break;
                        // 'history' Not fallback
                        default:
                            v = '';
                    }
                }

                return String(v);
            });
        });
    }

    var normalizeWriteArgs = (args) => {
        const flat = [];
        for (const it of args || []) {
            if (typeof it === 'string') {
                flat.push(it);
            } else if (it && typeof it === 'object') {
                // supports {name,value} or common aliases
                const n = it.name ?? it.field ?? it.key ?? it.n;
                const v = it.value ?? it.val ?? it.v;
                if (n !== undefined) {
                    flat.push(String(n), v == null ? '' : String(v));
                }
            }
        }
        return flat;
    }

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

    /**
     * Scan tags
     */
    this.browse = function (node) {
        return new Promise(async function (resolve, reject) {
            try {
                const page1 = await scanAddresses(client, {
                    // match: 'dainsy:*',   // filtra per prefisso
                    count: 2000,         // batch SCAN
                    max: 10000,          // al massimo 10k chiavi per questa chiamata
                    includeType: true,   // aggiunge type (string, hash, set, zset, list, stream, ...)
                  });
                var result = {};
                resolve(result);
            } catch (err) {
                if (err) {
                    logger.error(`'${data.name}' scan failure! ${err}`);
                }
                reject();
            }
        });
    }

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
                tagref: tag,
                metaTs: item.metaTs,
                metaQ: item.metaQ
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

                const fromRedis = Number(t.metaTs);
                const ts = Number.isFinite(fromRedis) ? fromRedis : Date.now();
                t.timestamp = ts;

                if (t.metaQ !== undefined) {
                    const q = Number(t.metaQ);
                    if (Number.isFinite(q)) t.quality = q;
                }

                // DAQ decision
                if (this.addDaq && deviceUtils.tagDaqToSave(t, t.timestamp)) {
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

    var scanAddresses = async (client, {
        match = '*',
        count = 1000,
        max = 50000,
        cursor = '0',
        includeType = true,
    } = {}) => {
        let cur = cursor;
        const items = [];
        let total = 0;

        // loop finche non esauriamo chiavi o raggiungiamo max
        do {
            // SCAN cursor [MATCH pattern] [COUNT count]
            const scanArgs = [
                cur,
                ...(match ? ['MATCH', String(match)] : []),
                ...(count ? ['COUNT', String(count)] : [])
              ];
              const res = await client.scan(...scanArgs);

              // compat: array [cursor, keys] oppure object { cursor, keys }
              const next = Array.isArray(res) ? res[0] : (res && res.cursor) || '0';
              const keys = Array.isArray(res) ? res[1] : (res && res.keys) || [];

            if (keys && keys.length) {
                total += keys.length;

                if (includeType) {
                    // Pipeline per TYPE su tutte le chiavi trovate in questo batch
                    const m = client.multi();
                    for (const k of keys) m.type(k);
                    const types = await m.exec();

                    for (let i = 0; i < keys.length; i++) {
                        const typeReply = Array.isArray(types?.[i]) ? types[i][1] : types?.[i];
                        items.push({ address: keys[i], type: String(typeReply || 'unknown') });
                        if (items.length >= max) break;
                    }
                } else {
                    for (const k of keys) {
                        items.push({ address: k });
                        if (items.length >= max) break;
                    }
                }
            }

            // abbiamo raggiunto il limite richiesto: fermiamoci e restituiamo il cursore per continuare dopo
            if (items.length >= max) {
                return { items, nextCursor: cur, total };
            }
        } while (cur !== '0');

        // Nessun altro risultato: nextCursor nullo
        return { items, nextCursor: null, total };
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
