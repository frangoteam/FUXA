/**
 * Connection Manager for Modbus
 * Manages shared physical connections (serial ports or TCP sockets)
 * to allow multiple Modbus slaves on the same connection
 */

"use strict";
var ModbusRTU;
const Mutex = require("async-mutex").Mutex;

// Singleton map: key -> { client, mutex, refCount, isOpen }
var connectionPool = new Map();

/**
 * Generate a connection key based on device properties
 */
function getConnectionKey(data, type) {
    if (type === 0) {
        // RTU
        // For RTU, include all serial parameters in key to prevent mixing different configs
        // This ensures devices with different configurations don't share the same connection
        return `${data.property.address}_${data.property.baudrate}_${data.property.databits}_${data.property.stopbits}_${data.property.parity}`;
    } else {
        // TCP
        return data.property.address;
    }
}

/**
 * Get or create a shared Modbus client for the given connection key
 */
function getConnection(data, type, modbusRTULib) {
    ModbusRTU = modbusRTULib;
    const key = getConnectionKey(data, type);

    if (!connectionPool.has(key)) {
        connectionPool.set(key, {
            client: new ModbusRTU(),
            mutex: new Mutex(),
            refCount: 0,
            isOpen: false,
            slaves: new Map(), // Track which slaves are using this connection
        });
    }

    const conn = connectionPool.get(key);
    conn.refCount++;

    // Track this specific slave ID
    const slaveId = data.property.slaveid ? parseInt(data.property.slaveid) : 1;
    if (!conn.slaves.has(slaveId)) {
        conn.slaves.set(slaveId, { refCount: 0 });
    }
    conn.slaves.get(slaveId).refCount++;

    return {
        key: key,
        client: conn.client,
        mutex: conn.mutex,
        slaveId: slaveId,
        release: () => releaseConnection(key, slaveId),
    };
}

/**
 * Release a connection reference
 */
function releaseConnection(key, slaveId) {
    const conn = connectionPool.get(key);
    if (!conn) return;

    // Decrement slave reference
    if (conn.slaves.has(slaveId)) {
        const slave = conn.slaves.get(slaveId);
        slave.refCount--;
        if (slave.refCount <= 0) {
            conn.slaves.delete(slaveId);
        }
    }

    // Decrement overall reference count
    conn.refCount--;

    // If no more references, mark for closure (but don't close immediately
    // to allow reconnection without full reinitialization)
    if (conn.refCount <= 0) {
        // Reset state but keep connection in pool for potential reuse
        conn.isOpen = false;
    }
}

/**
 * Check if a connection is open
 */
function isConnected(key) {
    const conn = connectionPool.get(key);
    return conn && conn.isOpen;
}

/**
 * Set connection open state
 */
function setConnected(key, isOpen) {
    const conn = connectionPool.get(key);
    if (conn) {
        conn.isOpen = isOpen;
    }
}

/**
 * Get connection info for debugging
 */
function getConnectionInfo() {
    const info = {};
    connectionPool.forEach((conn, key) => {
        info[key] = {
            refCount: conn.refCount,
            isOpen: conn.isOpen,
            slaveCount: conn.slaves.size,
            slaves: Array.from(conn.slaves.entries()).map(([id, data]) => ({
                id,
                refCount: data.refCount,
            })),
        };
    });
    return info;
}

module.exports = {
    getConnection,
    releaseConnection,
    isConnected,
    setConnected,
    getConnectionInfo,
    getConnectionKey,
};
