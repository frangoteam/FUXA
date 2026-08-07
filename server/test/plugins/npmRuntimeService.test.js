const fs = require('fs');
const os = require('os');
const path = require('path');

const {
    createRuntimeService,
    listInstalledPackages,
    listLegacyPackages,
} = require('../../runtime/plugins/npm-runtime-service');

describe('npm runtime service', () => {
    let tempDir;

    before(async () => {
        const chai = await import('chai');
        global.expect = chai.expect;
    });

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fuxa-plugin-runtime-'));
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('lists scoped packages from node_modules', () => {
        const moduleDir = path.join(tempDir, 'node_modules', '@scope', 'example');
        fs.mkdirSync(moduleDir, { recursive: true });
        fs.writeFileSync(path.join(moduleDir, 'package.json'), JSON.stringify({
            name: '@scope/example',
            version: '1.2.3',
        }));

        const installed = listInstalledPackages(tempDir);
        expect(installed['@scope/example']).to.equal('1.2.3');
    });

    it('lists legacy scoped packages directly under _pkg', () => {
        const packageDir = path.join(tempDir, '@scope', 'legacy');
        fs.mkdirSync(packageDir, { recursive: true });
        fs.writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify({
            name: '@scope/legacy',
            version: '4.5.6',
        }));

        const installed = listLegacyPackages(tempDir);
        expect(installed['@scope/legacy']).to.equal('4.5.6');
    });

    it('creates an isolated runtime workspace', () => {
        const service = createRuntimeService({ packageDir: tempDir });
        const paths = service.getPaths();

        expect(fs.existsSync(paths.runtimeDir)).to.equal(true);
        expect(fs.existsSync(paths.runtimePackageJson)).to.equal(true);
    });
});
