/**
 * Joins multiple path segments into a single path.
 * Ensures that there are no duplicate slashes.
 * @param parts - The path segments to join.
 * @returns The joined path.
 */
export function joinPath(...parts: string[]): string {
    return normalizePath(parts.join('/'));
}

/**
 * Normalizes a path by replacing backslashes with forward slashes
 * and removing duplicate slashes.
 * @param path - The path to normalize.
 * @returns The normalized path.
 */
export function normalizePath(path: string): string {
    if (!path || typeof path !== 'string') {
        return '/';
    }

    let out = path
        .replace(/\\/g, '/')      // Windows → POSIX
        .replace(/\/+/g, '/')     // compress "//"
        .replace(/\/$/, '');      // remove trailing slash

    return out || '/';
}


/**
 * Gets the parent directory of a given path.
 * @param path - The path to process.
 * @returns The parent directory path.
 */
export function getParentPath(path: string): string {
    const normalized = normalizePath(path);

    const driveMatch = normalized.match(/^\/([A-Za-z]:)/);
    const drive = driveMatch ? '/' + driveMatch[1] : '';
    const withoutDrive = drive ? normalized.slice(drive.length) : normalized;

    const parts = withoutDrive.split('/').filter(p => p);

    if (parts.length > 1) {
        parts.pop();
        return drive + '/' + parts.join('/');
    }

    return drive || '/';
}
