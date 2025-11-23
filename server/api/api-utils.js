const path = require('path');

/**
 * Validate that path is safe
 */
function isSafe(p) {
    return !p.includes('..') && !p.includes('\0');
}

module.exports = { isSafe };
