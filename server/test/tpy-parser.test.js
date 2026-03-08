'use strict';

const assert = require('node:assert/strict');
const { parseTpyFile } = require('../runtime/devices/adsclient/tpy-parser');

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

const INVALID_XML = 'this is not xml at all';

const EMPTY_SAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<TypeList>
</TypeList>`;

describe('ADS TPY parser', () => {
    it('parses TwinCAT 2 symbols and maps basic types', async () => {
        const tags = await parseTpyFile(TC2_SAMPLE);

        assert.equal(tags.length, 4);
        assert.equal(tags[0].name, 'MAIN.bMotorRunning');
        assert.equal(tags[0].type, 'boolean');
        assert.equal(tags[0].address, 'MAIN.bMotorRunning');
        assert.equal(tags[0].iGroup, 16448);
        assert.equal(tags[0].iOffset, 0);
        assert.equal(tags[1].type, 'number');
        assert.equal(tags[2].type, 'number');
        assert.equal(tags[3].type, 'string');
    });

    it('parses TwinCAT 3 symbols', async () => {
        const tags = await parseTpyFile(TC3_SAMPLE);

        assert.equal(tags.length, 3);
        assert.equal(tags[0].name, 'MAIN.bMotorRunning');
        assert.equal(tags[1].type, 'number');
        assert.equal(tags[2].type, 'number');
    });

    it('rejects invalid XML content', async () => {
        let err;
        try {
            await parseTpyFile(INVALID_XML);
        } catch (e) {
            err = e;
        }

        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('Failed to parse'));
    });

    it('returns empty list for XML without symbols', async () => {
        const tags = await parseTpyFile(EMPTY_SAMPLE);
        assert.ok(Array.isArray(tags));
        assert.equal(tags.length, 0);
    });
});
