"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlugins = void 0;
const schemas_1 = require("@pdfme/schemas");
const getPlugins = () => {
    return {
        Text: schemas_1.text,
        'Multi-Variable Text': schemas_1.multiVariableText,
        Table: schemas_1.table,
        Line: schemas_1.line,
        Rectangle: schemas_1.rectangle,
        Ellipse: schemas_1.ellipse,
        Image: schemas_1.image,
        SVG: schemas_1.svg,
        QR: schemas_1.barcodes.qrcode,
        'Japan Post': schemas_1.barcodes.japanpost,
        EAN13: schemas_1.barcodes.ean13,
        EAN8: schemas_1.barcodes.ean8,
        'Code 39': schemas_1.barcodes.code39,
        'Code 128': schemas_1.barcodes.code128,
        NW7: schemas_1.barcodes.nw7,
        ITF14: schemas_1.barcodes.itf14,
        UPC_A: schemas_1.barcodes.upca,
        UPC_E: schemas_1.barcodes.upce,
        'GS1 DataMatrix': schemas_1.barcodes.gs1datamatrix,
        PDF417: schemas_1.barcodes.pdf417,
        DateTime: schemas_1.dateTime,
        Date: schemas_1.date,
        Time: schemas_1.time,
        Select: schemas_1.select,
        Checkbox: schemas_1.checkbox,
        'Radio Group': schemas_1.radioGroup,
    };
};
exports.getPlugins = getPlugins;
