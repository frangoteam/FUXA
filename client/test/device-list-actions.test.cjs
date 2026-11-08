const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const componentPath = path.join(__dirname, '../src/app/device/device-list/device-list.component.ts');
const templatePath = path.join(__dirname, '../src/app/device/device-list/device-list.component.html');
const component = fs.readFileSync(componentPath, 'utf8');
const template = fs.readFileSync(templatePath, 'utf8');

function displayedColumnSets() {
    return [...component.matchAll(/readonly (def\w+Columns) = \[([^\]]+)\]/g)].map(match => ({
        name: match[1],
        columns: [...match[2].matchAll(/'([^']+)'/g)].map(column => column[1])
    }));
}

test('every configured device-list column has a matching table column', () => {
    const declared = new Set([...template.matchAll(/matColumnDef="([^"]+)"/g)].map(match => match[1]));
    assert.deepEqual(
        displayedColumnSets().flatMap(set => set.columns.filter(column => !declared.has(column)).map(column => `${set.name}:${column}`)),
        []
    );
});

test('Redis and SNMP devices expose their matching scan actions', () => {
    assert.match(template, /deviceSelected\?\.type === deviceType\.REDIS/);
    assert.match(template, /deviceSelected\?\.type === deviceType\.SNMP/);
    assert.match(template, /deviceType\.REDIS[\s\S]*onScanRedisTag\(\)/);
    assert.match(template, /deviceType\.SNMP[\s\S]*onScanSnmpTag\(\)/);
});
