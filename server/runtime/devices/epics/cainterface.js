'use strict';

const koffi = require('koffi');
const path = require('path');
const os = require('os');
const EventEmitter = require('events');

/**
 * EPICS Channel Access Low-Level Interface for FUXA
 * Optimized for high performance and reliable connection management.
 */

// --- Constants & Codes ---
const DBR = {
    STRING: 0,
    INT: 1,
    SHORT: 1,
    FLOAT: 2,
    ENUM: 3,
    CHAR: 4,
    LONG: 5,
    DOUBLE: 6
};

const STATE = {
    ECA_NORMAL: 1,
    ECA_TIMEOUT: 80,
    CS_NEVER_CONN: 0,
    CS_PREV_CONN: 1,
    CS_CONN: 2,
    CS_CLOSED: 3,
    OP_CONN_UP: 6,
    OP_CONN_DOWN: 7
};

const MASK = {
    DBE_VALUE: 1,
    DBE_LOG: 2,
    DBE_ALARM: 4
};

const MAX_STRING_SIZE = 40;

// --- Native Type Mapping ---
const nativeType = {
    [DBR.STRING]: 'char',
    [DBR.SHORT]: 'short',
    [DBR.FLOAT]: 'float',
    [DBR.ENUM]: 'ushort',
    [DBR.CHAR]: 'char',
    [DBR.LONG]: 'int',
    [DBR.DOUBLE]: 'double'
};

class CAInterface extends EventEmitter {
    constructor(libPath, logger) {
        super();
        this.logger = logger;
        this.libca = null;
        this.channels = new Map(); // pvName -> Channel Object
        this.initialized = false;
        this.pendTimer = null;
        
        this._loadLibrary(libPath);
        this._initCA();
    }

    _loadLibrary(libPath) {
        try {
            let actualPath = libPath;
            if (!actualPath) {
                // Try to find it in the project's local clibs directory first (recommended for optimization)
                const localDir = path.join(__dirname, 'clibs');
                // Fallback to old node-epics-ca path if still exists (for backward compatibility)
                const nodeModulesDir = path.join(__dirname, '..', '..', '..', 'node_modules', 'node-epics-ca', 'lib', 'clibs');
                
                const arch = os.arch() === 'x64' ? '64' : '32';
                let subDir = '';
                let fileName = '';

                switch (os.platform()) {
                    case 'win32': 
                        subDir = 'win' + arch; 
                        fileName = 'ca.dll'; 
                        break;
                    case 'linux': 
                        subDir = 'linux' + arch; 
                        fileName = 'libca.so'; 
                        break;
                    case 'darwin': 
                        subDir = 'darwin64'; 
                        fileName = 'libca.dylib'; 
                        break;
                }

                if (subDir) {
                    const localPath = path.join(localDir, subDir, fileName);
                    if (require('fs').existsSync(localPath)) {
                        actualPath = localPath;
                    } else {
                        actualPath = path.join(nodeModulesDir, subDir, fileName);
                    }
                }
            }

            if (!actualPath) throw new Error('Could not determine libca path for platform ' + os.platform());

            // Add to PATH for dependencies (like Com.dll on Windows)
            const dirname = path.dirname(actualPath);
            if (os.platform() === 'win32') {
                process.env.PATH = dirname + path.delimiter + process.env.PATH;
            }

            this.libca = koffi.load(actualPath);
            this._defineFunctions();
        } catch (err) {
            if (this.logger) this.logger.error(`CAInterface: Failed to load libca: ${err.message}`);
            throw err;
        }
    }

    _defineFunctions() {
        const l = this.libca;
        
        // Types
        this.chanId = koffi.pointer('chanId', koffi.opaque());
        this.evid = koffi.pointer('evid', koffi.opaque());
        
        // Structs
        this.event_args_t = koffi.struct('event_args_t', {
            usr: 'void *',
            chid: this.chanId,
            type: 'long',
            count: 'long',
            dbr: 'void *',
            status: 'int'
        });

        this.connection_args_t = koffi.struct('connection_args_t', {
            chid: this.chanId,
            op: 'long'
        });

        // Callbacks
        this.ConnectionCallback = koffi.proto('ConnectionCallback', 'void', [this.connection_args_t]);
        this.MonitorCallback = koffi.proto('MonitorCallback', 'void', [this.event_args_t]);
        this.GetCallback = koffi.proto('GetCallback', 'void', [this.event_args_t]);
        this.PutCallback = koffi.proto('PutCallback', 'void', [this.event_args_t]);

        // Functions
        this.ca_context_create = l.func('ca_context_create', 'int', ['int']);
        this.ca_context_destroy = l.func('ca_context_destroy', 'void', []);
        this.ca_message = l.func('ca_message', 'string', ['int']);
        this.ca_pend_event = l.func('ca_pend_event', 'int', ['double']);
        this.ca_pend_io = l.func('ca_pend_io', 'int', ['double']);
        this.ca_flush_io = l.func('ca_flush_io', 'int', []);
        
        this.ca_create_channel = l.func('ca_create_channel', 'int', [
            'string', 
            koffi.pointer(this.ConnectionCallback), 
            'void *', 
            'int', 
            koffi.out(koffi.pointer(this.chanId))
        ]);
        
        this.ca_clear_channel = l.func('ca_clear_channel', 'int', [this.chanId]);
        this.ca_field_type = l.func('ca_field_type', 'short', [this.chanId]);
        this.ca_element_count = l.func('ca_element_count', 'int', [this.chanId]);
        this.ca_state = l.func('ca_state', 'short', [this.chanId]);
        this.ca_name = l.func('ca_name', 'string', [this.chanId]);

        this.ca_array_get_callback = l.func('ca_array_get_callback', 'int', [
            'long', 'ulong', this.chanId, koffi.pointer(this.GetCallback), 'void *'
        ]);
        
        this.ca_array_put_callback = l.func('ca_array_put_callback', 'int', [
            'long', 'ulong', this.chanId, 'void *', koffi.pointer(this.PutCallback), 'void *'
        ]);

        this.ca_create_subscription = l.func('ca_create_subscription', 'int', [
            'int', 'ulong', this.chanId, 'long', 
            koffi.pointer(this.MonitorCallback), 
            'void *', 
            koffi.out(koffi.pointer(this.evid))
        ]);
        
        this.ca_clear_subscription = l.func('ca_clear_subscription', 'int', [this.evid]);
    }

    _initCA() {
        const res = this.ca_context_create(1); // enable_preemptive_callback
        if (res !== STATE.ECA_NORMAL) {
            throw new Error(`ca_context_create failed: ${this.ca_message(res)}`);
        }
        this.initialized = true;

        // Start background pend loop
        // In Node.js, we need to regularly call ca_pend_event to allow C callbacks to be processed
        // if we are not in a truly preemptive mode or if we want to ensure JS gets the events.
        this.pendTimer = setInterval(() => {
            this.ca_pend_event(0.001); // Pend for 1ms
        }, 20); // 50Hz
    }

    destroy() {
        if (this.pendTimer) {
            clearInterval(this.pendTimer);
            this.pendTimer = null;
        }
        
        // Disconnect all channels first
        for (const ch of this.channels.values()) {
            try {
                ch.destroy();
            } catch (e) {
                if (this.logger) this.logger.error(`CAInterface: Error destroying channel: ${e.message}`);
            }
        }
        this.channels.clear();
        
        if (this.initialized) {
            try {
                // Give a small moment for C cleanup to settle
                this.ca_pend_event(0.01); 
                this.ca_context_destroy();
            } catch (e) {
                if (this.logger) this.logger.error(`CAInterface: Error destroying context: ${e.message}`);
            }
            this.initialized = false;
        }
    }

    getChannel(pvName) {
        if (this.channels.has(pvName)) {
            return this.channels.get(pvName);
        }
        const ch = new Channel(pvName, this);
        this.channels.set(pvName, ch);
        return ch;
    }

    // Utility to decode DBR data
    _decodeValue(ptr, type, count) {
        try {
            if (type === DBR.STRING) {
                const results = [];
                for (let i = 0; i < count; i++) {
                    const buf = koffi.decode(ptr, i * MAX_STRING_SIZE, 'char', MAX_STRING_SIZE);
                    let str = Buffer.from(buf).toString('utf8');
                    const nullIdx = str.indexOf('\0');
                    if (nullIdx >= 0) str = str.substring(0, nullIdx);
                    results.push(str);
                }
                return count === 1 ? results[0] : results;
            } else {
                const t = nativeType[type];
                if (!t) return null;
                const data = koffi.decode(ptr, t, count);
                if (count === 1) {
                    // 确保返回的是原始数值而非 TypedArray 的一部分
                    return Array.isArray(data) || ArrayBuffer.isView(data) ? data[0] : data;
                } else {
                    return Array.from(data);
                }
            }
        } catch (err) {
            if (this.logger) this.logger.error(`CAInterface: _decodeValue error: ${err.message}`);
            return null;
        }
    }
}

class Channel extends EventEmitter {
    constructor(pvName, ca) {
        super();
        this.pvName = pvName;
        this.ca = ca;
        this.chid = null;
        this.evid = null;
        this.connected = false;
        this.type = -1;
        this.count = 0;

        this._connCb = null;
        this._monCb = null;

        this._create();
    }

    _create() {
        const chidOut = [null];
        this._connCb = koffi.register((args) => {
            const oldConn = this.connected;
            this.connected = (args.op === STATE.OP_CONN_UP);
            
            if (this.connected) {
                this.type = this.ca.ca_field_type(this.chid);
                this.count = this.ca.ca_element_count(this.chid);
            }

            if (oldConn !== this.connected) {
                this.emit('connection', this.connected);
            }
        }, koffi.pointer(this.ca.ConnectionCallback));

        const res = this.ca.ca_create_channel(this.pvName, this._connCb, null, 0, chidOut);
        this.chid = chidOut[0];
        if (res !== STATE.ECA_NORMAL) {
            this.ca.logger.error(`ca_create_channel failed for ${this.pvName}: ${this.ca.ca_message(res)}`);
        }
        this.ca.ca_flush_io();
    }

    monitor(asString = false) {
        if (!this.chid || this.evid) return;

        this._monCb = koffi.register((args) => {
            if (args.status === STATE.ECA_NORMAL) {
                const val = this.ca._decodeValue(args.dbr, args.type, args.count);
                this.emit('value', val);
            }
        }, koffi.pointer(this.ca.MonitorCallback));

        const evidOut = [null];
        const type = asString ? DBR.STRING : this.type;
        const res = this.ca.ca_create_subscription(
            type, this.count, this.chid, 
            MASK.DBE_VALUE | MASK.DBE_ALARM, 
            this._monCb, null, evidOut
        );
        this.evid = evidOut[0];
        this.ca.ca_flush_io();
    }

    get(asString = false) {
        return new Promise((resolve, reject) => {
            if (!this.connected || !this.chid) return reject(new Error('Channel not connected'));

            const cb = koffi.register((args) => {
                koffi.unregister(cb);
                if (args.status === STATE.ECA_NORMAL) {
                    resolve(this.ca._decodeValue(args.dbr, args.type, args.count));
                } else {
                    reject(new Error(`ca_get failed: ${this.ca.ca_message(args.status)}`));
                }
            }, koffi.pointer(this.ca.GetCallback));

            const type = asString ? DBR.STRING : this.type;
            const res = this.ca.ca_array_get_callback(type, this.count, this.chid, cb, null);
            if (res !== STATE.ECA_NORMAL) {
                koffi.unregister(cb);
                reject(new Error(`ca_array_get_callback failed: ${this.ca.ca_message(res)}`));
            }
            this.ca.ca_flush_io();
        });
    }

    put(value, asString = false) {
        return new Promise((resolve, reject) => {
            if (!this.connected || !this.chid) return reject(new Error('Channel not connected'));

            const cb = koffi.register((args) => {
                koffi.unregister(cb);
                if (args.status === STATE.ECA_NORMAL) {
                    resolve();
                } else {
                    reject(new Error(`ca_put failed: ${this.ca.ca_message(args.status)}`));
                }
            }, koffi.pointer(this.ca.PutCallback));

            const type = asString ? DBR.STRING : this.type;
            let buf;
            if (type === DBR.STRING) {
                const vals = Array.isArray(value) ? value : [value];
                buf = Buffer.alloc(vals.length * MAX_STRING_SIZE);
                vals.forEach((v, i) => buf.write(String(v).substring(0, MAX_STRING_SIZE - 1), i * MAX_STRING_SIZE));
            } else {
                const t = nativeType[type];
                let vals = Array.isArray(value) ? value : [value];
                
                // Ensure numeric types are actually numbers
                if (t === 'double' || t === 'float' || t === 'int' || t === 'short' || t === 'ushort') {
                    vals = vals.map(v => (typeof v === 'string') ? Number(v) : v);
                }

                try {
                    buf = koffi.as(vals, `${t}*`);
                } catch (e) {
                    koffi.unregister(cb);
                    return reject(new Error(`Value type mismatch for EPICS type ${t}: ${e.message}`));
                }
            }

            const res = this.ca.ca_array_put_callback(type, Array.isArray(value) ? (value.length || 1) : 1, this.chid, buf, cb, null);
            if (res !== STATE.ECA_NORMAL) {
                koffi.unregister(cb);
                reject(new Error(`ca_array_put_callback failed: ${this.ca.ca_message(res)}`));
            }
            this.ca.ca_flush_io();
        });
    }

    destroy() {
        // Prevent multiple destroy calls
        if (!this.chid && !this.evid && !this._connCb && !this._monCb) return;

        try {
            this.ca.channels.delete(this.pvName);
            
            if (this.evid) {
                try { this.ca.ca_clear_subscription(this.evid); } catch (e) {}
                this.evid = null;
            }
            if (this.chid) {
                try { this.ca.ca_clear_channel(this.chid); } catch (e) {}
                this.chid = null;
            }
            
            // Unregister callbacks safely
            if (this._connCb) {
                try { koffi.unregister(this._connCb); } catch (e) {}
                this._connCb = null;
            }
            if (this._monCb) {
                try { koffi.unregister(this._monCb); } catch (e) {}
                this._monCb = null;
            }
        } catch (err) {
            if (this.ca.logger) this.ca.logger.error(`Channel destroy error for ${this.pvName}: ${err.message}`);
        }
        
        this.removeAllListeners();
    }
}

module.exports = CAInterface;
