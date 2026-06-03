const path = require('path');

function normalizeRelativePath(input) {
    if (typeof input !== 'string' || !input) {
        return null;
    }
    if (input.indexOf('\0') !== -1) {
        return null;
    }
    if (path.isAbsolute(input)) {
        return null;
    }
    const normalized = path.normalize(input).replace(/^[\\/]+/, '');
    if (!normalized || normalized === '.' || normalized === path.sep) {
        return null;
    }
    const parts = normalized.split(path.sep);
    if (parts.includes('..')) {
        return null;
    }
    return normalized;
}

function resolveWithin(baseDir, targetPath) {
    const normalized = normalizeRelativePath(targetPath);
    if (!normalized) {
        return null;
    }
    const resolvedBase = path.resolve(baseDir);
    const resolvedTarget = path.resolve(resolvedBase, normalized);
    const relative = path.relative(resolvedBase, resolvedTarget);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return null;
    }
    return { resolvedTarget, normalized };
}

module.exports = {
    normalizeRelativePath,
    resolveWithin
};
