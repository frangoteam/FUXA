const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function loadTreeTable() {
    const filename = path.join(__dirname, '../src/app/gui-helpers/treetable/treetable.component.ts');
    const { outputText, diagnostics } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        fileName: filename,
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
            experimentalDecorators: true
        },
        reportDiagnostics: true
    });
    assert.equal(diagnostics.length, 0);
    const exports = {};
    const decorator = () => () => {};
    vm.runInNewContext(outputText, {
        exports,
        require: () => ({
            Component: decorator,
            Input: decorator,
            Output: decorator,
            ViewChild: decorator,
            EventEmitter: class {}
        })
    }, { filename });
    return exports;
}

const { TreetableComponent, Node, NodeType } = loadTreeTable();

function addNode(tree, id, text, parent = null, type = NodeType.Object) {
    const node = new Node(id, text);
    node.class = type;
    tree.addNode(node, parent, true);
    return node;
}

test('prefix-matching OPC UA node names keep descendants with their parent', () => {
    const tree = new TreetableComponent();
    const objects = addNode(tree, 'objects', 'Objects');
    const cepn1 = addNode(tree, 'cepn1', 'cepn1', objects);
    addNode(tree, 'cepn1.value', 'Value', cepn1, NodeType.Variable);
    const cepn116 = addNode(tree, 'cepn116', 'cepn116', objects);
    addNode(tree, 'cepn116.value', 'Value', cepn116, NodeType.Variable);
    const lent10 = addNode(tree, 'lent10', 'lent10', objects);
    addNode(tree, 'lent10.value', 'Value', lent10, NodeType.Variable);
    const lent104 = addNode(tree, 'lent104', 'lent104', objects);
    addNode(tree, 'lent104.value', 'Value', lent104, NodeType.Variable);

    assert.deepEqual([...tree.nodeToItems()].map(node => node.id), [
        'objects',
        'cepn1', 'cepn1.value',
        'cepn116', 'cepn116.value',
        'lent10', 'lent10.value',
        'lent104', 'lent104.value'
    ]);
});

test('tree ordering remains alphabetical at each level and omits hidden nodes', () => {
    const tree = new TreetableComponent();
    const zulu = addNode(tree, 'zulu', 'Zulu');
    const hidden = addNode(tree, 'zulu.hidden', 'Alpha', zulu, NodeType.Variable);
    hidden.visible = false;
    addNode(tree, 'zulu.visible', 'Beta', zulu, NodeType.Variable);
    const alpha = addNode(tree, 'alpha', 'Alpha');
    addNode(tree, 'alpha.child', 'Zulu', alpha, NodeType.Variable);

    assert.deepEqual([...tree.nodeToItems()].map(node => node.id), [
        'alpha', 'alpha.child', 'zulu', 'zulu.visible'
    ]);
});

test('unsorted web API trees retain insertion order', () => {
    const tree = new TreetableComponent();
    addNode(tree, 'third', 'Third');
    addNode(tree, 'first', 'First');
    addNode(tree, 'second', 'Second');

    assert.deepEqual([...tree.nodeToItems(false)].map(node => node.id), ['third', 'first', 'second']);
});
