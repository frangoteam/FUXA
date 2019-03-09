const snap7 = require('node-snap7');
const EventEmitter = require('events');
const debug = require('debug')('S7Client');
const { isIPv4 } = require('net');
const dns = require('dns');
const random = require('lodash.random');
const datatypes = require('./datatypes');

/**
 * High level API for Siemens S7 PLCs
 *
 * Fires: `connect`, `disconnect`, `connect_error`, `value`
 *
 * @emits connect - PLC connected
 * @emits disconnect - PLC disconnected
 * @emits connect_error - Connection error
 * @emits value - Var read
 */
class S7Client extends EventEmitter {

    /**
     * Construct a new S7Client
     *
     * @param {Object} options - Options
     * @param {string} [options.name=S7PLC] - Human readable Name for this PLC
     * @param {string} [options.host=localhost] - Hostname or IP
     * @param {int} [options.port=102] - Port
     * @param {int} [options.rack=0] - Rack
     * @param {int} [options.Slot=1] - Slot
     * @param {int} [options.connectionCheckInterval=2000] - Interval in ms to check if PLC is connected
     * @param {int} [options.maxRetryDelay=6000] - Max reconnect delay
     * @param {int} [options.alivePkgCycle=45] - Send a keepAlive package every nth connectionCheck
     */
    constructor(options) {
        super(); // init EventEmitter

        this.client = null;
        this.opts = {
            name: "S7PLC",
            host: "localhost",
            port: 102,
            rack: 0,
            slot: 1,
            connectionCheckInterval: 2000,
            maxRetryDelay: 60 * 1000,
            alivePkgCycle: 45 // send a request every 45x connectionCheck
        };
        Object.assign(this.opts, options || {});

        this.client = new snap7.S7Client();
        this.client.SetParam(this.client.RemotePort, this.opts.port);
    }

    /**
     * Establish connection to the plc
     *
     * @returns {Promise} resolves with CpuInfo Object
     */
    async connect() {
        if (this.isConnected()) return Promise.reject(new Error(`Already connected to ${this.opts.name}`));
        debug(`Connecting to ${this.opts.name} on ${this.opts.host}:${this.opts.port}, Rack=${this.opts.rack} Slot=${this.opts.slot}`);

        return (isIPv4(this.opts.host) ? Promise.resolve(this.opts.host) : S7Client.dnsLookup(this.opts.host))
            .then(ip => new Promise((resolve, reject) => {
                this.client.ConnectTo(ip, this.opts.rack, this.opts.slot, (err) => {
                    if (err) {
                        err = this.client.ErrorText(err).trim();
                        debug(`Connect-Error: ${err}`);
                        this.emit('connect_error', err);
                        return reject(err);
                    }
                    this._setupAliveCheck();
                    debug(`Connected to ${this.opts.name}`);
                    resolve(this.getCpuInfo().then(cpuInfo => {
                        this.emit('connect', cpuInfo);
                        return cpuInfo
                    }));
                });
            }));
    }


    /**
     * Establish connection to the plc and keep retrying on error
     *
     * @returns {Promise} resolves with CpuInfo Object
     */
    async autoConnect() {
        let self = this;
        let retryDelay = this.opts.connectionCheckInterval;

        function _retry() {
            debug(`Retry connect to ${self.opts.name}`);
            self.connect().catch(() => {
                retryDelay = Math.round(retryDelay * random(1.3, 1.7, true));
                if (retryDelay > self.opts.maxRetryDelay) retryDelay = self.opts.maxRetryDelay;
                self._retryTimeout = setTimeout(_retry, retryDelay);
            });
        }

        this.on('disconnect', manual => (!manual) && _retry());

        if (this.isConnected()) {
            return this.getCpuInfo();
        } else {
            try {
                return await this.connect();
            }
            catch (e) {
                setTimeout(_retry, retryDelay);
                throw e;
            }
        }
    }


    /**
     * @private
     */
    _setupAliveCheck() {
        let cnt = 1;
        clearInterval(this._aliveCheckInterval);
        this._aliveCheckInterval = setInterval(() => {
            cnt++;

            // send a keep alive request every nth aliveCheck cycle
            if (this.opts.alivePkgCycl !== false && cnt >= this.opts.alivePkgCycle) {
                this.client.PlcStatus((err, res) => {
                });
                cnt = 0;
            }

            if (this.isConnected()) return;
            debug(`Alive check: failed`);
            this.emit('disconnect', false);
            clearInterval(this._aliveCheckInterval);
        }, this.opts.connectionCheckInterval);
    }


    /**
     * Disconnect from the PLC
     */
    disconnect() {
        clearInterval(this._aliveCheckInterval);
        clearTimeout(this._retryTimeout);
        this.client.Disconnect();
        this.emit('disconnect', true);
    }


    /**
     * Return whether the client is connected or not
     * @returns {boolean}
     */
    isConnected() {
        return this.client.Connected();
    }


    /**
     * Return DateTime from PLC
     * @returns {Promise}
     */
    getPlcDateTime() {
        return this._cbToPromise(this.client.GetPlcDateTime.bind(this.client));
    }


    /**
     * Return getCpuInfo from PLC
     * @returns {Promise}
     */
    async getCpuInfo() {
        return this._cbToPromise(this.client.GetCpuInfo.bind(this.client));
    }

    /**
     * Read a DB and parse the result
     * @param {int} DBNr - The DB Number to read
     * @param {array} vars - Array of Var objects
     * @param {int} vars[].start - Position of the first byte
     * @param {int} [vars[].bit] - Position of the bit in the byte
     * @param {Datatype} vars[].type - Data type (BYTE, WORD, INT, etc), see {@link /s7client/?api=Datatypes|Datatypes}
     * @returns {Promise} - Resolves to the vars array with populate *value* property
     */
    async readDB(DBNr, vars) {
        return new Promise((resolve, reject) => {
            if (vars.length === 0) return resolve([]);

            let end = 0;
            let offset = Number.MAX_SAFE_INTEGER;
            vars.forEach(v => {
                if (v.start < offset) offset = v.start;
                if (end < v.start + datatypes[v.type].bytes) {
                    end = v.start + datatypes[v.type].bytes;
                }
            });
            debug(`${this.opts.name}: ReadDB DB=${DBNr}, Offset=${offset}, Length=${end - offset}`);
            this.client.DBRead(DBNr, offset, end - offset, (err, res) => {
                if (err) return this._getErr(err);
                resolve(vars.map(v => {
                    v.value = datatypes[v.type].parser(res, v.start - offset, v.bit);
                    this.emit('value', v);
                    return v;
                }));
            });
        });
    }

    /**
     * Read multiple Vars and parse the result
     * @param {array} vars - Array of Var objects
     * @param {int} vars[].start - Position of the first byte
     * @param {int} [vars[].bit] - Position of the bit in the byte
     * @param {Datatype} vars[].type - Data type (BYTE, WORD, INT, etc), see {@link /s7client/?api=Datatypes|Datatypes}
     * @param {string} vars[].area - Area (pe, pa, mk, db, ct, tm)
     * @param {int} [vars[].dbnr] - DB Nr if read from area=db
     * @returns {Promise} - Resolves to the vars array with populate *value* property
     */
    async readVars(vars) {
        return new Promise((resolve, reject) => {
            debug(`${this.opts.name}: ReadMultiVars`, vars);
            let toRead = vars.map(v => {
                return {
                    Area: this.client['S7Area' + v.area.toUpperCase()],
                    WordLen: datatypes[v.type].S7WordLen,
                    DBNumber: v.dbnr,
                    Start: v.start,
                    Amount: 1
                }
            });

            this.client.ReadMultiVars(toRead, (err, res) => {
                if (err) return this._getErr(err);
                let errs = [];
                res = vars.map((v, i) => {
                    if (res[i].Result !== 0) return errs.push(this.client.ErrorText(res[i].Result));
                    v.value = datatypes[v.type].parser(res[i].Data);
                    this.emit('value', v);
                    return v;
                });
                if (errs.length) return reject(this._getErr(errs));
                resolve(res);
            });
        });
    }

    /**
     * Write multiple Vars
     * @param {array} vars - Array of Var objects
     * @param {int} vars[].start - Position of the first byte
     * @param {int} [vars[].bit] - Position of the bit in the byte
     * @param {Datatype} vars[].type - Data type (BYTE, WORD, INT, etc), see {@link /s7client/?api=Datatypes|Datatypes}
     * @param {string} vars[].area - Area (pe, pa, mk, db, ct, tm)
     * @param {string} [vars[].dbnr] - DB Nr if read from area=db
     * @param vars[].value - Value
     * @returns {Promise} - Resolves to the vars array with populate *value* property
     */
    async writeVars(vars) {
        debug(`${this.opts.name}: WriteMultiVars`, vars);
        let toWrite = vars.map(v => ({
            Area: this.client['S7Area' + v.area.toUpperCase()],
            WordLen: datatypes[v.type].S7WordLen,
            DBNumber: v.dbnr,
            Start: v.type === 'BOOL' ? v.start * 8 + v.bit : v.start,
            Amount: 1,
            Data: datatypes[v.type].formatter(v.value)
        }));

        return new Promise((resolve, reject) => {
            this.client.WriteMultiVars(toWrite, (err, res) => {
                if (err) return this._getErr(err);
                let errs = [];

                res = vars.map((v, i) => {
                    if (res[i].Result !== 0) return errs.push(this.client.ErrorText(res[i].Result));
                    return v;
                });
                if (errs.length) return reject(this._getErr(errs));
                resolve(res);
            });
        });
    }


    /**
     * Read a single var
     * @param {string} v.area - Area (pe, pa, mk, db, ct, tm)
     * @param {Datatype} v.type - Data type (BYTE, WORD, INT, etc), see {@link /s7client/?api=Datatypes|Datatypes}
     * @param {int} v.start - Position of the first byte
     * @param {string} [v.dbnr] - DB Nr if read from area=db
     * @param {int} [v.bit] - Position of the bit in the byte
     * @returns {Promise} - Resolves to the var obj with populate *value* property
     */
    async readVar(v) {
        if (v.area === 'db' && !v.dbnr) throw new Error(`Param dbnr is mandatory for area=db`);
        return this.readVars([v])
            .then(r => r[0]);
    }


    /**
     * Write a single var
     * @param {string} v.area - Area (pe, pa, mk, db, ct, tm)
     * @param {Datatype} v.type - Data type (BYTE, WORD, INT, etc), see {@link /s7client/?api=Datatypes|Datatypes}
     * @param {int} v.start - Position of the first byte
     * @param {string} [v.dbnr] - DB Nr if read from area=db
     * @param {int} [v.bit] - Position of the bit in the byte
     * @param v.value - Value to write
     * @return {Promise<*>}
     */
    async writeVar(v) {
        return this.writeVars([v]).then(erg => erg[0]);
    }


    /**
     * Construct Error object
     *
     * @private
     */
    _getErr(s7err) {
        if (Array.isArray(s7err)) return new Error(`${this.opts.name} Errors: ` + s7err.join('; '));
        return new Error(`${this.opts.name}: ` + this.client.ErrorText(s7err));
    }

    /**
     * Callback to promise
     *
     * @private
     */
    async _cbToPromise(fn) {
        return new Promise((resolve, reject) => {
            fn((err, data) => {
                if (err) return reject(this._getErr(err));
                resolve(data);
            });
        });
    }

    /**
     * Get IP address from hostname
     *
     * @private
     */
    static dnsLookup(host) {
        return new Promise((resolve, reject) => {
            dns.lookup(host, 4, function (err, ip) {
                if (err) {
                    debug(`Error resolving IP for Host ${host}`);
                    return reject(err);
                }
                debug(`Resolved Host ${host} to IP ${ip}`);
                resolve(ip);
            });
        });
    }

}

module.exports.S7Client = S7Client;
module.exports.Datatypes = datatypes;