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
    if (!p) return p;

    // Normalizza POSIX: "/" e nessun doppio slash
    let posix = p.replace(/\\/g, '/').replace(/\/+/g, '/');

    // --- CASE A: POSIX real path (Mac/Linux) ---
    // /Users/... or /home/... or /var/... or /
    if (process.platform !== 'win32') {
        if (posix.startsWith('/')) {
            return posix;      // <-- keep POSIX path exactly as-is
        }
        return path.resolve(posix);
    }

    // --- CASE B: Windows real drive: /C:/something ---
    const drive = posix.match(/^\/([A-Za-z]:\/.*)/);
    if (drive) {
        return drive[1].replace(/\//g, path.sep);
    }

    // --- CASE C: Windows relative (virtual roots, etc.) ---
    if (posix.startsWith('/')) posix = posix.substring(1);
    return path.resolve(posix.replace(/\//g, path.sep));
}

/**
 * Validate that path is safe
 */
function isSafe(p) {
    return !p.includes('..') && !p.includes('\0');
}

module.exports = { normalizePosix, toNative, isSafe };
