'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const utils = require('../../runtime/utils');

const tags = ['select', 'input', 'button'];
const disable = source => utils.domStringSetAttribute(source, tags, 'disabled');

const cases = [
    ['multiple inputs', '<input name="a"><input name="b">', '<input disabled name="a"><input disabled name="b">'],
    ['mixed controls preserve earlier changes', '<select><option>A</option></select><input><button>Run</button>', '<select disabled ><option>A</option></select><input disabled ><button disabled >Run</button>'],
    ['nested markup and closing tags', '<div><input value="first"><button>Run</button></div>', '<div><input disabled value="first"><button disabled >Run</button></div>'],
    ['case and multiline attributes', '<INPUT\nvalue="A"><BUTTON>Run</BUTTON>', '<INPUT disabled\nvalue="A"><BUTTON disabled >Run</BUTTON>'],
    ['self-closing controls', '<input/><input /><input value="A"/>', '<input disabled /><input disabled /><input disabled value="A"/>'],
    ['quoted angle brackets', '<input title="a > b" data-note=\'<button>\'><button title=\'x > y\'>Go</button>', '<input disabled title="a > b" data-note=\'<button>\'><button disabled title=\'x > y\'>Go</button>'],
    ['tag name boundaries', '<input-list></input-list><button-group></button-group><selectable>Text</selectable>', '<input-list></input-list><button-group></button-group><selectable>Text</selectable>'],
    ['comments and CDATA', '<!-- <input> --><![CDATA[<button>]]><input>', '<!-- <input> --><![CDATA[<button>]]><input disabled >'],
    ['raw text elements', '<script>const text = "<input>";</script><style>.x:after {content:"<button>"}</style><textarea><input></textarea><button>Go</button>', '<script>const text = "<input>";</script><style>.x:after {content:"<button>"}</style><textarea><input></textarea><button disabled >Go</button>'],
    ['existing disabled attributes', '<input disabled><button DISABLED="disabled">Go</button>', '<input disabled><button DISABLED="disabled">Go</button>'],
    ['attribute names inside values', '<input data-label="disabled" disabled-label="yes">', '<input disabled data-label="disabled" disabled-label="yes">'],
    ['unselected elements and text', '<div>Before</div><textarea>After</textarea>', '<div>Before</div><textarea>After</textarea>']
];

describe('Disabled HMI control markup', function () {
    for (const [name, source, expected] of cases) {
        it(name, function () {
            assert.equal(disable(source), expected);
        });
    }

    it('is idempotent when the same fragment is filtered twice', function () {
        const once = disable('<input value="A"><button>Run</button>');
        assert.equal(disable(once), once);
    });

    async function loadProject(svgcontent) {
        const filename = require.resolve('../../runtime/project');
        const projectModule = new Module(filename, module);
        projectModule.filename = filename;
        projectModule.paths = Module._nodeModulePaths(path.dirname(filename));
        const storage = {
            TableType: Object.fromEntries(['GENERAL', 'VIEWS', 'DEVICES', 'TEXTS', 'ALARMS', 'RECIPES', 'NOTIFICATIONS', 'SCRIPTS', 'REPORTS', 'LOCATIONS', 'ARMARKERS'].map(name => [name, name])),
            init: async () => true,
            getSection: async table => table === 'VIEWS' ? [{ value: JSON.stringify({
                id: 'v1', name: 'Controls', svgcontent,
                items: { group: { id: 'controlGroup', property: { events: [{ type: 'click' }] } } }
            }) }] : []
        };
        const nativeRequire = projectModule.require.bind(projectModule);
        projectModule.require = request => request === './prjstorage' ? storage : nativeRequire(request);
        projectModule._compile(fs.readFileSync(filename, 'utf8'), filename);
        const project = projectModule.exports;
        const runtime = {
            checkPermission: (permission, item) => permission === 'admin' ? { show: true, enabled: true } : { show: Boolean(item), enabled: false },
            scriptsMgr: { isAuthorised: () => false }
        };
        await project.init({}, { info() {}, error(error) { throw new Error(error); } }, runtime);
        await project.load();
        return project;
    }

    describe('real project permission filtering with controlled storage', function () {
        let previousDevices;
        beforeEach(function () { previousDevices = process.env.DEVICES; delete process.env.DEVICES; });
        afterEach(function () {
            if (previousDevices === undefined) delete process.env.DEVICES;
            else process.env.DEVICES = previousDevices;
        });

        const original = '<svg><g id="controlGroup"><foreignObject><div><select><option>A</option></select><input value="A"><button>Run</button></div></foreignObject></g></svg>';
        const expected = '<svg><g id="controlGroup"><foreignObject><div><select disabled ><option>A</option></select><input disabled value="A"><button disabled >Run</button></div></foreignObject></g></svg>';

        it('disables all controls without corrupting the project or its admin copy', async function () {
            const project = await loadProject(original);
            const restricted = await project.getProject('viewer', 'viewer');
            assert.equal(restricted.hmi.views[0].svgcontent, expected);
            assert.deepEqual(restricted.hmi.views[0].items.group.property.events, []);
            const admin = await project.getProject('admin', 'admin');
            assert.equal(admin.hmi.views[0].svgcontent, original);
            assert.equal(admin.hmi.views[0].items.group.property.events.length, 1);
        });

        it('preserves markup when retrieving a restricted single view repeatedly', async function () {
            const project = await loadProject(original);
            for (let i = 0; i < 2; i++) {
                const view = await project.getProjectView('v1', 'viewer');
                assert.equal(view.svgcontent, expected);
            }
        });
    });
});
