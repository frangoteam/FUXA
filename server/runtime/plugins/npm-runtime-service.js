const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { createRequire } = require('module');

function listInstalledPackages(baseDir) {
    const nodeModulesDir = path.basename(baseDir) === 'node_modules'
        ? baseDir
        : path.join(baseDir, 'node_modules');
    const packages = {};

    if (!fs.existsSync(nodeModulesDir)) {
        return packages;
    }

    const entries = fs.readdirSync(nodeModulesDir, { withFileTypes: true });
    entries.forEach((entry) => {
        if (!entry.isDirectory()) {
            return;
        }
        if (entry.name.startsWith('@')) {
            const scopeDir = path.join(nodeModulesDir, entry.name);
            fs.readdirSync(scopeDir, { withFileTypes: true }).forEach((scopedEntry) => {
                if (!scopedEntry.isDirectory()) {
                    return;
                }
                _readPackageInfo(path.join(scopeDir, scopedEntry.name), packages);
            });
            return;
        }
        _readPackageInfo(path.join(nodeModulesDir, entry.name), packages);
    });

    return packages;
}

function listLegacyPackages(packageDir) {
    const packages = {};
    if (!fs.existsSync(packageDir)) {
        return packages;
    }
    const entries = fs.readdirSync(packageDir, { withFileTypes: true });
    entries.forEach((entry) => {
        if (!entry.isDirectory() || entry.name === 'runtime') {
            return;
        }
        if (entry.name.startsWith('@')) {
            const scopeDir = path.join(packageDir, entry.name);
            fs.readdirSync(scopeDir, { withFileTypes: true }).forEach((scopedEntry) => {
                if (!scopedEntry.isDirectory()) {
                    return;
                }
                _readPackageInfo(path.join(scopeDir, scopedEntry.name), packages);
            });
            return;
        }
        _readPackageInfo(path.join(packageDir, entry.name), packages);
    });
    return packages;
}

function createRuntimeService(options) {
    const logger = options.logger;
    const packageDir = path.resolve(options.packageDir);
    const runtimeDir = path.join(packageDir, 'runtime');
    const runtimePackageJson = path.join(runtimeDir, 'package.json');
    let runtimeRequire = null;

    function init() {
        fs.mkdirSync(packageDir, { recursive: true });
        fs.mkdirSync(runtimeDir, { recursive: true });
        if (!fs.existsSync(runtimePackageJson)) {
            fs.writeFileSync(runtimePackageJson, JSON.stringify({
                name: 'fuxa-plugin-runtime',
                private: true,
                version: '1.0.0',
                description: 'FUXA isolated runtime for dynamic npm packages',
            }, null, 2));
        }
        runtimeRequire = createRequire(runtimePackageJson);
    }

    function getInstalledPackages() {
        return Object.assign(
            {},
            listLegacyPackages(packageDir),
            listInstalledPackages(runtimeDir)
        );
    }

    function isRuntimeManaged(name) {
        return !!listInstalledPackages(runtimeDir)[name];
    }

    async function installPackage(name, version) {
        init();
        const spec = version && version !== 'latest' ? `${name}@${version}` : name;
        await _runNpmCommand(runtimeDir, ['install', '--no-audit', '--no-fund', '--save-exact', spec], logger);
        const installed = getInstalledPackages();
        return installed[name] || version || 'latest';
    }

    async function uninstallPackage(name) {
        init();
        await _runNpmCommand(runtimeDir, ['uninstall', '--no-audit', '--no-fund', name], logger);
    }

    function requirePackage(name) {
        init();
        try {
            return runtimeRequire(name);
        } catch (runtimeErr) {
            const legacyPackageJson = _resolveLegacyPackageJson(packageDir, name);
            if (legacyPackageJson) {
                return createRequire(legacyPackageJson)(name);
            }
            try {
                return require(name);
            } catch {
                throw runtimeErr;
            }
        }
    }

    function resolvePackage(name) {
        init();
        try {
            return runtimeRequire.resolve(name);
        } catch (runtimeErr) {
            const legacyPackageJson = _resolveLegacyPackageJson(packageDir, name);
            if (legacyPackageJson) {
                return createRequire(legacyPackageJson).resolve(name);
            }
            return require.resolve(name);
        }
    }

    function resolvePackageJson(name) {
        init();
        const runtimePackages = listInstalledPackages(runtimeDir);
        if (runtimePackages[name]) {
            return runtimeRequire.resolve(path.posix.join(name, 'package.json'));
        }
        const legacyPackageJson = _resolveLegacyPackageJson(packageDir, name);
        if (legacyPackageJson) {
            return legacyPackageJson;
        }
        return require.resolve(path.posix.join(name, 'package.json'));
    }

    init();

    return {
        init,
        getInstalledPackages,
        installPackage,
        uninstallPackage,
        require: requirePackage,
        resolve: resolvePackage,
        resolvePackageJson,
        isRuntimeManaged,
        getPaths() {
            return {
                packageDir,
                runtimeDir,
                runtimePackageJson,
            };
        },
    };
}

function _readPackageInfo(packageRoot, packages) {
    const packageJson = path.join(packageRoot, 'package.json');
    if (!fs.existsSync(packageJson)) {
        return;
    }
    try {
        const content = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
        if (content && content.name && content.version) {
            packages[content.name] = content.version;
        }
    } catch {
    }
}

function _resolveLegacyPackageJson(packageDir, packageName) {
    const packageJson = path.join(packageDir, packageName, 'package.json');
    return fs.existsSync(packageJson) ? packageJson : null;
}

function _runNpmCommand(cwd, args, logger) {
    const isWindows = process.platform === 'win32';
    const command = isWindows ? (process.env.ComSpec || 'cmd.exe') : 'npm';
    const commandArgs = isWindows ? ['/d', '/s', '/c', 'npm.cmd', ...args] : args;
    return new Promise((resolve, reject) => {
        const child = spawn(command, commandArgs, {
            cwd,
            env: Object.assign({}, process.env, { npm_config_loglevel: 'warn' }),
            windowsHide: true,
        });
        let stderr = '';
        let stdout = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        child.on('error', reject);
        child.on('close', (code) => {
            if (code === 0) {
                resolve(stdout);
                return;
            }
            const error = new Error((stderr || stdout || `npm exited with code ${code}`).trim());
            error.code = 'npm_runtime_error';
            if (logger) {
                logger.error(`[plugin-runtime] npm ${args[0]} failed: ${error.message}`);
            }
            reject(error);
        });
    });
}

module.exports = {
    createRuntimeService,
    listInstalledPackages,
    listLegacyPackages,
};
