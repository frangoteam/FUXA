/**
 * Tests for adsclient/tpy-parser.js
 */

'use strict';

const { parseTpyFile } = require('../runtime/devices/adsclient/tpy-parser');

// Sample TwinCAT 2 .tpy XML
const TC2_SAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<TypeList>
  <Symbol>
    <Name>MAIN.bMotorRunning</Name>
    <Type>BOOL</Type>
    <IGroup>16448</IGroup>
    <IOffset>0</IOffset>
  </Symbol>
  <Symbol>
    <Name>MAIN.rSetpoint</Name>
    <Type>REAL</Type>
    <IGroup>16448</IGroup>
    <IOffset>4</IOffset>
  </Symbol>
  <Symbol>
    <Name>MAIN.nSpeed</Name>
    <Type>INT</Type>
    <IGroup>16448</IGroup>
    <IOffset>8</IOffset>
  </Symbol>
  <Symbol>
    <Name>MAIN.sStatus</Name>
    <Type>STRING</Type>
    <IGroup>16448</IGroup>
    <IOffset>12</IOffset>
  </Symbol>
</TypeList>`;

// Sample TwinCAT 3 .tpy XML
const TC3_SAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<TcModuleClass>
  <Symbol>
    <Name>MAIN.bMotorRunning</Name>
    <Type>BOOL</Type>
    <IGroup>16448</IGroup>
    <IOffset>0</IOffset>
  </Symbol>
  <Symbol>
    <Name>MAIN.rTemperature</Name>
    <Type>LREAL</Type>
    <IGroup>16448</IGroup>
    <IOffset>4</IOffset>
  </Symbol>
  <Symbol>
    <Name>MAIN.nCount</Name>
    <Type>DINT</Type>
    <IGroup>16448</IGroup>
    <IOffset>12</IOffset>
  </Symbol>
</TcModuleClass>`;

// Invalid XML
const INVALID_XML = `this is not xml at all`;

// Empty symbol list
const EMPTY_SAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<TypeList>
</TypeList>`;

async function runTests() {
    let passed = 0;
    let failed = 0;

    const assert = (condition, message) => {
        if (condition) {
            console.log(`  ✅ PASS: ${message}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${message}`);
            failed++;
        }
    };

    console.log('\n--- TwinCAT 2 Format ---');
    try {
        const tags = await parseTpyFile(TC2_SAMPLE);
        assert(tags.length === 4, `Should extract 4 tags (got ${tags.length})`);
        assert(tags[0].name === 'MAIN.bMotorRunning', `First tag name should be MAIN.bMotorRunning`);
        assert(tags[0].type === 'boolean', `BOOL should map to boolean type`);
        assert(tags[0].address === 'MAIN.bMotorRunning', `Address should equal name for ADS`);
        assert(tags[1].type === 'number', `REAL should map to number type`);
        assert(tags[2].type === 'number', `INT should map to number type`);
        assert(tags[3].type === 'string', `STRING should map to string type`);
        assert(tags[0].iGroup === 16448, `IGroup should be parsed as integer`);
        assert(tags[0].iOffset === 0, `IOffset should be parsed as integer`);
    } catch (err) {
        console.error(`  ❌ TC2 test threw error: ${err.message}`);
        failed++;
    }

    console.log('\n--- TwinCAT 3 Format ---');
    try {
        const tags = await parseTpyFile(TC3_SAMPLE);
        assert(tags.length === 3, `Should extract 3 tags (got ${tags.length})`);
        assert(tags[0].name === 'MAIN.bMotorRunning', `First tag name should be MAIN.bMotorRunning`);
        assert(tags[1].type === 'number', `LREAL should map to number type`);
        assert(tags[2].type === 'number', `DINT should map to number type`);
    } catch (err) {
        console.error(`  ❌ TC3 test threw error: ${err.message}`);
        failed++;
    }

    console.log('\n--- Invalid XML ---');
    try {
        await parseTpyFile(INVALID_XML);
        console.error(`  ❌ FAIL: Should throw error for invalid XML`);
        failed++;
    } catch (err) {
        assert(err.message.includes('Failed to parse'), `Should throw parse error for invalid XML`);
    }

    console.log('\n--- Empty Symbol List ---');
    try {
        const tags = await parseTpyFile(EMPTY_SAMPLE);
        assert(tags.length === 0, `Should return empty array for empty symbol list`);
    } catch (err) {
        console.error(`  ❌ Empty test threw error: ${err.message}`);
        failed++;
    }

    console.log(`\n--- Results: ${passed} passed, ${failed} failed ---\n`);
    process.exit(failed > 0 ? 1 : 0);
}

runTests();