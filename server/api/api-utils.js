const path = require('path');

/**
 * Normalize into POSIX-style internally (/folder/sub)
 */
function normalizePosix(p) {
    return p
        .replace(/\\/g, '/')      // Windows → POSIX
        .replace(/\/+/g, '/')     // remove "//"
        .replace(/\/$/, '')       // no trailing slash
        || '/';
}

/**
 * Convert POSIX path into native OS path
 */
function toNative(p) {
    const s = p.replace(/^\//, '').replace(/\//g, path.sep);
    return path.isAbsolute(s) ? s : path.resolve(s);
}

/**
 * Validate that path is safe
 */
function isSafe(p) {
    return !p.includes('..') && !p.includes('\0');
}

module.exports = { normalizePosix, toNative, isSafe };
