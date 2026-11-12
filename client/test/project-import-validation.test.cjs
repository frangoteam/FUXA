const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function loadProjectService() {
    const filename = path.join(__dirname, '../src/app/_services/project.service.ts');
    const { outputText, diagnostics } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        fileName: filename,
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
            experimentalDecorators: true,
            emitDecoratorMetadata: false
        },
        reportDiagnostics: true
    });
    assert.equal(diagnostics.length, 0);

    const decorator = () => () => {};
    const imports = {
        '@angular/core': {
            Injectable: decorator,
            Output: decorator,
            EventEmitter: class {},
        },
        'rxjs': {
            Observable: class {},
            Subject: class {},
            firstValueFrom: value => value,
            of: value => value,
        },
        '../_helpers/utils': {
            Utils: { isNullOrUndefined: value => value === null || value === undefined }
        }
    };
    const exports = {};
    vm.runInNewContext(outputText, {
        exports,
        require: name => imports[name] || {},
        console,
        Map,
        JSON,
    }, { filename });
    return exports.ProjectService;
}

function serviceWithNotifications() {
    const ProjectService = loadProjectService();
    const service = Object.create(ProjectService.prototype);
    const notifications = [];
    service.notifyError = (...args) => notifications.push(args);
    return { service, notifications };
}

test('accepts projects with every required top-level field', () => {
    const { service, notifications } = serviceWithNotifications();

    assert.equal(service.verifyProject({ version: '1.0', hmi: {}, devices: {} }), true);
    assert.deepEqual(notifications, []);
});

test('reports every missing project field', () => {
    const { service, notifications } = serviceWithNotifications();

    assert.equal(service.verifyProject({ version: '1.0' }), false);
    assert.deepEqual(notifications, [['msg.project-format-error', 'hmi, devices']]);
});

test('rejects a non-object project without throwing', () => {
    const { service, notifications } = serviceWithNotifications();

    assert.equal(service.verifyProject(null), false);
    assert.deepEqual(notifications, [['msg.project-format-error', 'version, hmi, devices']]);
});
