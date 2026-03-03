/**
 * 'adsclient/tpy-parser': Parser for Beckhoff TwinCAT .tpy symbol files
 * Supports TwinCAT 2 and TwinCAT 3 .tpy XML format
 */

'use strict';

const xml2js = require('xml2js');

/**
 * Map TwinCAT data types to FUXA tag types
 */
const TYPE_MAP = {
    'BOOL':   'boolean',
    'BYTE':   'number',
    'WORD':   'number',
    'DWORD':  'number',
    'SINT':   'number',
    'USINT':  'number',
    'INT':    'number',
    'UINT':   'number',
    'DINT':   'number',
    'UDINT':  'number',
    'LINT':   'number',
    'ULINT':  'number',
    'REAL':   'number',
    'LREAL':  'number',
    'STRING': 'string',
    'TIME':   'number',
    'DATE':   'number',
    'TOD':    'number',
    'DT':     'number',
};

/**
 * Parse a .tpy XML file content and extract symbols as FUXA tags
 * @param {string} xmlContent - The raw XML string from the .tpy file
 * @returns {Promise<Array>} - Array of tag objects { name, type, address }
 */
const parseTpyFile = (xmlContent) => {
    return new Promise((resolve, reject) => {
        xml2js.parseString(xmlContent, { explicitArray: false }, (err, result) => {
            if (err) {
                return reject(new Error(`Failed to parse .tpy file: ${err.message}`));
            }

            try {
                const tags = [];

                // TwinCAT 2 format: TypeList > DataTypes > Symbol
                // TwinCAT 3 format: TcModuleClass > DataTypes > Symbol
                var symbolList = [];

                // Try TwinCAT 3 format first
                if (result && result.TcModuleClass && result.TcModuleClass.Symbol) {
                    symbolList = result.TcModuleClass.Symbol;
                }
                // Try TwinCAT 2 format
                else if (result && result.TypeList && result.TypeList.Symbol) {
                    symbolList = result.TypeList.Symbol;
                }
                // Try nested DataTypes format
                else if (result && result.TcModuleClass && result.TcModuleClass.DataTypes) {
                    symbolList = _extractFromDataTypes(result.TcModuleClass.DataTypes);
                }

                // Normalize to array
                if (!Array.isArray(symbolList)) {
                    symbolList = [symbolList];
                }

                // Extract each symbol
                for (var i = 0; i < symbolList.length; i++) {
                    var symbol = symbolList[i];
                    if (!symbol) continue;

                    var name = symbol.Name || symbol.name || symbol.$ && symbol.$.Name;
                    var rawType = symbol.Type || symbol.type || symbol.$ && symbol.$.Type || 'UNKNOWN';
                    var iGroup = symbol.IGroup || symbol.igroup || '0';
                    var iOffset = symbol.IOffset || symbol.ioffset || '0';

                    if (!name) continue;

                    // Skip ARRAY and STRUCT types for v1 (scalar only)
                    if (rawType.toUpperCase().startsWith('ARRAY') ||
                        rawType.toUpperCase().startsWith('STRUCT')) {
                        continue;
                    }

                    // Map TwinCAT type to FUXA type
                    var fuxaType = TYPE_MAP[rawType.toUpperCase()] || 'string';

                    tags.push({
                        name: name,
                        type: fuxaType,
                        address: name,          // ADS uses symbol name as address
                        rawType: rawType,       // Keep original TwinCAT type for reference
                        iGroup: parseInt(iGroup),
                        iOffset: parseInt(iOffset),
                    });
                }

                resolve(tags);
            } catch (parseErr) {
                reject(new Error(`Failed to extract symbols: ${parseErr.message}`));
            }
        });
    });
};

/**
 * Extract symbols from nested DataTypes structure (TwinCAT 3)
 * @param {object} dataTypes
 * @returns {Array}
 */
const _extractFromDataTypes = (dataTypes) => {
    var symbols = [];

    if (!dataTypes) return symbols;

    var dataTypeList = dataTypes.DataType;
    if (!dataTypeList) return symbols;

    if (!Array.isArray(dataTypeList)) {
        dataTypeList = [dataTypeList];
    }

    for (var i = 0; i < dataTypeList.length; i++) {
        var dt = dataTypeList[i];
        if (dt && dt.SubItem) {
            var subItems = Array.isArray(dt.SubItem) ? dt.SubItem : [dt.SubItem];
            for (var j = 0; j < subItems.length; j++) {
                var subItem = subItems[j];
                if (subItem && subItem.Name) {
                    symbols.push({
                        Name: (dt.Name ? dt.Name + '.' : '') + subItem.Name,
                        Type: subItem.Type || 'UNKNOWN',
                        IGroup: subItem.IGroup || '0',
                        IOffset: subItem.IOffset || '0',
                    });
                }
            }
        }
    }

    return symbols;
};

module.exports = { parseTpyFile };