"use strict";
const express = require('express');
const fs = require('fs');
const path = require('path');
const { generate } = require('@pdfme/generator');
const { getInputFromTemplate, getDefaultFont } = require('@pdfme/common');
const { multiVariableText, text, barcodes, image, svg, line, table, rectangle, ellipse, dateTime, date, time, select, checkbox, radioGroup } = require('@pdfme/schemas');
// Custom signature plugin that uses image.pdf for rendering
const signature = {
    ui: () => null, // Dummy UI for server-side
    pdf: image.pdf,
    propPanel: {
        schema: {},
        defaultSchema: {
            name: '',
            type: 'signature',
            content: 'data:image/png;base64,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',
            position: { x: 0, y: 0 },
            width: 62.5,
            height: 37.5,
        },
    },
};
let runtime;
function init(_runtime, _secureFnc, _checkGroupsFnc) {
    runtime = _runtime;
}
// Function to process dynamic data for test reports
async function processDynamicData(template, inputs, tableConfigs = [], _runtime = null, globalTimeRange = null) {
    const activeRuntime = _runtime || runtime;

    // Simple approach: stringify the template, replace all @tag placeholders, parse back
    let templateJson = JSON.stringify(template);
    // Find all @tagname patterns in the template - try multiple regex patterns
    const regex1 = /"@(\w+)(?::([^"]*))?"/g; // Quoted @tag or @tag:format
    const regex2 = /@(\w+)(?::([^"\s]*))?/g; // Just @tag or @tag:format (unquoted in context)
    const tagMatches1 = templateJson.match(regex1) || [];
    const tagMatches2 = templateJson.match(regex2) || [];
    const tagMatches = tagMatches1;
    // Replace each @tagname or @tagname:format with actual tag value
    for (const match of tagMatches) {
        try {
            const matchResult = /"@(\w+)(?::([^"]*))?"/.exec(match);
            if (!matchResult) continue;
            const tagName = matchResult[1];
            const format = matchResult[2] || '';
            
            // First check if the tag value is provided in inputs (custom data from Node-RED)
            let tagValue;
            if (inputs && inputs.length > 0 && inputs[0] && inputs[0].hasOwnProperty(tagName)) {
                tagValue = inputs[0][tagName];
            } else {
                // Fall back to runtime tag value
                tagValue = getTagValue(tagName, activeRuntime);
            }
            if (format && format.trim() !== '') {
                tagValue = formatNumber(tagValue, format);
            }
            const replacement = JSON.stringify(String(tagValue));
            templateJson = templateJson.replace(new RegExp(match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
        } catch (error) {
            console.error(`Failed to process tag match ${match}:`, error.message);
            // Continue processing other matches
        }
    }
    // Parse back to object
    const processedTemplate = JSON.parse(templateJson);

    // Process table configurations
    if (tableConfigs && tableConfigs.length > 0) {
        for (const tableConfig of tableConfigs) {
            // Check if custom table data is already provided in inputs
            let tableData;
            if (inputs && inputs.length > 0 && inputs[0] && inputs[0][tableConfig.fieldName]) {
                // Use custom table data from inputs
                tableData = inputs[0][tableConfig.fieldName];
            } else {
                // Process table config to get data from runtime
                tableData = await processTableConfig(tableConfig, activeRuntime, globalTimeRange);
                // Set the table data in inputs
                inputs[0][tableConfig.fieldName] = tableData;
            }

            // Set dynamic content for tables
            let fieldFound = false;
            for (const schema of processedTemplate.schemas) {
                for (const field of schema) {
                    if (field.name === tableConfig.fieldName && field.type === 'table') {
                        field.content = JSON.stringify(tableData);
                        fieldFound = true;
                    }
                }
            }
        }
    }

    // Handle custom table data that doesn't have tableConfigs
    if (inputs && inputs.length > 0 && inputs[0]) {
        for (const key of Object.keys(inputs[0])) {
            const value = inputs[0][key];
            if (Array.isArray(value) && value.length > 0 && Array.isArray(value[0])) {
                // This looks like table data (2D array)
                let fieldFound = false;
                for (const schema of processedTemplate.schemas) {
                    for (const field of schema) {
                        if (field.name === key && field.type === 'table') {
                            field.content = JSON.stringify(value);
                            fieldFound = true;
                            break;
                        }
                    }
                    if (fieldFound) break;
                }
            }
        }
    }

    return { template: processedTemplate, inputs };
}
function getTagValue(tagName, activeRuntime = runtime) {
    try {
        // First convert tag name to tag ID
        const tagId = activeRuntime.devices.getTagId(tagName);
        if (!tagId) {
            throw new Error(`Tag '${tagName}' not found in FUXA project. Please ensure the tag exists and is properly configured.`);
        }
        // Then get the tag value using the tag ID
        const tagResult = activeRuntime.devices.getTagValue(tagId, true);
        if (!tagResult) {
            throw new Error(`Tag '${tagName}' exists but has no value. Please ensure the device is connected and the tag is readable.`);
        }
        // Extract the actual value from the result object
        // Tags can be boolean, number, or string - any value is valid including 0, false, ""
        const tagValue = tagResult.value;
        return tagValue;
    }
    catch (error) {
        throw error; // Re-throw to fail the PDF generation
    }
}
// Get alarm history data
async function getAlarmsHistory(fromTime, toTime, activeRuntime = runtime) {
    try {
        const query = { start: fromTime, end: toTime };
        const result = await activeRuntime.alarmsMgr.getAlarmsHistory(query, -1);
        return result || [];
    } catch (error) {
        console.error('Error getting alarm history:', error);
        return [];
    }
}
// Process table configuration to generate table data
async function processTableConfig(tableConfig, activeRuntime = runtime, globalTimeRange = null) {
    try {
        // Determine time range
        let fromTime, toTime;
        if (tableConfig.useReportTimeRange) {
            if (globalTimeRange) {
                // Use global time range from report settings
                fromTime = parseTimeValue(globalTimeRange.from, activeRuntime);
                toTime = parseTimeValue(globalTimeRange.to, activeRuntime);
            } else {
                // Fallback to last 24 hours
                toTime = new Date();
                fromTime = new Date(toTime.getTime() - 24 * 60 * 60 * 1000);
            }
        }
        else {
            // Parse custom time range
            fromTime = parseTimeValue(tableConfig.timeRange.from, activeRuntime);
            toTime = parseTimeValue(tableConfig.timeRange.to, activeRuntime);
        }
        // Get data for all columns
        let tableRows = [];
        if (tableConfig.isAlarmTable) {
            // Handle alarm table data
            const alarmData = await getAlarmsHistory(fromTime.getTime(), toTime.getTime(), activeRuntime);
            // Convert alarm data to table rows
            for (const alarm of alarmData) {
                const row = [];
                for (const column of tableConfig.columns) {
                    switch (column.label) {
                        case 'Tag Name':
                            row.push(alarm.name || '');
                            break;
                        case 'Type':
                            row.push(alarm.type || '');
                            break;
                        case 'Status':
                            row.push(alarm.status || '');
                            break;
                        case 'Message':
                            row.push(alarm.text || '');
                            break;
                        case 'Group':
                            row.push(alarm.group || '');
                            break;
                        case 'On Time':
                            row.push(alarm.ontime ? formatTimestamp(new Date(alarm.ontime), column.timestampFormat || 'YYYY-MM-DD HH:mm:ss') : '');
                            break;
                        case 'Off Time':
                            row.push(alarm.offtime ? formatTimestamp(new Date(alarm.offtime), column.timestampFormat || 'YYYY-MM-DD HH:mm:ss') : '');
                            break;
                        case 'Ack Time':
                            row.push(alarm.acktime ? formatTimestamp(new Date(alarm.acktime), column.timestampFormat || 'YYYY-MM-DD HH:mm:ss') : '');
                            break;
                        case 'User Ack':
                            row.push(alarm.userack || '');
                            break;
                        default:
                            row.push('');
                            break;
                    }
                }
                tableRows.push(row);
            }
        } else {
            const columnData = {};
            for (const column of tableConfig.columns) {
                if (column.isTimestamp) {
                    // For timestamp columns, we'll use the timestamps from DAQ data
                    continue;
                }
                const tagName = column.tagName.startsWith('@') ? column.tagName.substring(1) : column.tagName;
                const values = await getDaqHistory(tagName, fromTime, toTime, activeRuntime);
                columnData[column.tagName] = values;
            }
            // Build table rows
            const timestamps = Object.keys(columnData[Object.keys(columnData)[0]] || {});
            // Sort timestamps with latest first
            timestamps.sort((a, b) => parseInt(b) - parseInt(a));
            for (const timestamp of timestamps) {
                const row = [];
                for (const column of tableConfig.columns) {
                    if (column.isTimestamp) {
                        // Format timestamp
                        const date = new Date(parseInt(timestamp));
                        const formatted = column.timestampFormat ?
                            formatTimestamp(date, column.timestampFormat) :
                            date.toISOString();
                        row.push(formatted);
                    }
                    else {
                        // Get tag value
                        const value = columnData[column.tagName][timestamp];
                        // Apply FUXA formatting if specified
                        let formattedValue = value !== undefined ? value : '';
                        if (column.valueFormat && column.valueFormat.trim() !== '' && formattedValue !== '') {
                            formattedValue = formatNumber(formattedValue, column.valueFormat);
                        }
                        row.push(formattedValue);
                    }
                }
                tableRows.push(row);
            }
        }
        return tableRows;
    }
    catch (error) {
        console.error('Error processing table config:', error);
        return [];
    }
}
// Parse time value (ISO string, @tag reference, or dynamic expression)
function parseTimeValue(timeValue, activeRuntime = runtime) {
    if (!timeValue) return new Date();

    // Trim whitespace from the input
    timeValue = timeValue.trim();

    if (timeValue.startsWith('@')) {
        // Get value from tag
        const tagName = timeValue.substring(1);
        const tagValue = getTagValue(tagName, activeRuntime);
        if (tagValue) {
            return new Date(tagValue);
        }
        return new Date();
    }

    // Handle dynamic time expressions
    const now = new Date();
    if (timeValue.toLowerCase() === 'now') {
        return now;
    }

    // Handle "now + X unit" format (minutes, hours, days, m, h, d)
    const nowPlusMatch = timeValue.toLowerCase().match(/^now\s*\+\s*(\d+)\s*(minutes?|hours?|days?|m|h|d)$/);
    if (nowPlusMatch) {
        const value = parseInt(nowPlusMatch[1]);
        const unit = nowPlusMatch[2].toLowerCase();
        let multiplier = 60 * 1000; // minutes default
        if (unit.startsWith('hour') || unit === 'h') multiplier = 60 * 60 * 1000;
        if (unit.startsWith('day') || unit === 'd') multiplier = 24 * 60 * 60 * 1000;
        return new Date(now.getTime() + value * multiplier);
    }

    // Handle "now - X unit" format (minutes, hours, days, m, h, d)
    const nowMinusMatch = timeValue.toLowerCase().match(/^now\s*-\s*(\d+)\s*(minutes?|hours?|days?|m|h|d)$/);
    if (nowMinusMatch) {
        const value = parseInt(nowMinusMatch[1]);
        const unit = nowMinusMatch[2].toLowerCase();
        let multiplier = 60 * 1000; // minutes default
        if (unit.startsWith('hour') || unit === 'h') multiplier = 60 * 60 * 1000;
        if (unit.startsWith('day') || unit === 'd') multiplier = 24 * 60 * 60 * 1000;
        return new Date(now.getTime() - value * multiplier);
    }

    return new Date(timeValue);
}
// Format timestamp using moment.js style formatting
function formatTimestamp(date, format) {
    // Simple implementation supporting common moment.js style formats
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    let result = format
        .replace(/YYYY/g, year)
        .replace(/MM/g, month)
        .replace(/DD/g, day)
        .replace(/HH/g, hours)
        .replace(/mm/g, minutes)
        .replace(/ss/g, seconds)
        .replace(/SSS/g, milliseconds)
        .replace(/T/g, 'T') // ISO 8601 separator
        .replace(/Z/g, 'Z'); // UTC timezone indicator
    return result;
}
function formatNumber(value, format) {
    try {
        if (typeof value !== 'number' && isNaN(Number(value))) {
            return String(value);
        }
        
        const num = Number(value);
        
        // If no format specified, return as string
        if (format == null || typeof format !== 'string' || format.trim() === '') {
            return String(num);
        }
        
        // Simple format handling - support basic decimal places
        if (typeof format === 'string' && format.startsWith('0.')) {
            const parts = format.split('.');
            if (parts && parts.length > 1 && parts[1] && typeof parts[1] === 'string') {
                const decimals = parts[1].length;
                return num.toFixed(decimals);
            }
        } else if (format === '0') {
            return Math.round(num).toString();
        } else if (typeof format === 'string' && format.includes && format.includes(',')) {
            // Basic comma separation for thousands
            return num.toLocaleString();
        }
        
        // Default to 2 decimal places if format not recognized
        return num.toFixed(2);
    } catch (error) {
        console.error('Error in formatNumber:', error, 'value:', value, 'format:', format, 'typeof format:', typeof format);
        return String(value);
    }
}
// Process table data for DAQ tags
async function processTableData(schema, activeRuntime = runtime) {
    try {
        let content = schema.content;
        // If content is a string, parse it as JSON
        if (typeof content === 'string') {
            try {
                content = JSON.parse(content);
            }
            catch (e) {
                // If not JSON, treat as simple string
                return [];
            }
        }
        // If content is an array, process each row
        if (Array.isArray(content)) {
            // Check if this is a DAQ table (contains @tagname entries)
            const hasDaqTags = content.some(row => Array.isArray(row) && row.some(cell => typeof cell === 'string' && cell.startsWith('@')));
            if (hasDaqTags) {
                // This is a DAQ table - create multiple rows with historical data
                const daqRows = [];
                // Get all unique DAQ tags from the table
                const daqTags = new Set();
                content.forEach(row => {
                    if (Array.isArray(row)) {
                        row.forEach(cell => {
                            if (typeof cell === 'string' && cell.startsWith('@')) {
                                daqTags.add(cell.substring(1)); // Remove @
                            }
                        });
                    }
                });
                // Get historical data for each tag
                const tagData = {};
                for (const tagName of daqTags) {
                    const values = await getDaqHistory(tagName, undefined, undefined, activeRuntime);
                    tagData[tagName] = values;
                }
                // Create rows for each timestamp
                const timestamps = Object.keys(tagData[Array.from(daqTags)[0]] || {});
                for (const timestamp of timestamps.slice(-10)) { // Last 10 entries
                    const row = [];
                    content[0].forEach(cell => {
                        if (typeof cell === 'string' && cell.startsWith('@')) {
                            const tagName = cell.substring(1);
                            row.push(tagData[tagName][timestamp] || 0);
                        }
                        else {
                            row.push(cell);
                        }
                    });
                    daqRows.push(row);
                }
                return daqRows;
            }
            else {
                // Regular table - just replace @tagname with current values
                const processedContent = [];
                for (const row of content) {
                    if (Array.isArray(row)) {
                        const processedRow = [];
                        for (const cell of row) {
                            if (typeof cell === 'string' && cell.startsWith('@')) {
                                const tagName = cell.substring(1);
                                try {
                                    const tagValue = getTagValue(tagName);
                                    processedRow.push(tagValue !== null && tagValue !== undefined ? tagValue.toString() : '');
                                }
                                catch (error) {
                                    throw error;
                                }
                            }
                            else {
                                processedRow.push(cell);
                            }
                        }
                        processedContent.push(processedRow);
                    }
                    else {
                        processedContent.push(row);
                    }
                }
                return processedContent;
            }
        }
        return content;
    }
    catch (error) {
        console.error('Error processing table data:', error);
        return [];
    }
}
// Get historical DAQ data for a tag
async function getDaqHistory(tagName, fromTime, toTime, activeRuntime = runtime) {
    try {
        // First convert tag name to tag ID
        const tagId = activeRuntime.devices.getTagId(tagName);
        if (!tagId) {
            console.error(`PDFME: Tag '${tagName}' not found in FUXA project`);
            throw new Error(`Tag '${tagName}' not found in FUXA project. Please ensure the tag exists and is properly configured.`);
        }
        const from = fromTime || new Date(Date.now() - 24 * 60 * 60 * 1000); // Default to 24 hours ago
        const to = toTime || new Date();
        // Use the correct FUXA method for getting historical data
        const values = await activeRuntime.devices.getHistoricalTags([tagId], from.getTime(), to.getTime());
        // getHistoricalTags returns an object with tagId as key
        // Since we only requested one tag, get the array for that tagId
        const tagData = values && values[tagId] ? values[tagId] : [];
        // Convert to timestamp-keyed object
        const result = {};
        if (tagData && tagData.length > 0) {
            tagData.forEach(item => {
                if (item && item.x !== undefined && item.y !== undefined && item.y !== null) {
                    const timestamp = new Date(item.x).getTime();
                    result[timestamp] = item.y;
                }
            });
        }
        return result;
    }
    catch (error) {
        console.error(`PDFME: Error getting DAQ history for ${tagName}:`, error.message);
        throw error;
    }
}
// Get DAQ data for a tag
async function getDaqData(tagName, activeRuntime = runtime) {
    try {
        // Get DAQ values for the last 24 hours
        const now = new Date();
        const from = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
        const to = now;
        // Use the same method as the DAQ API
        const values = await activeRuntime.daqStorage.getNodeValues(tagName, from, to);
        if (values && values.length > 0) {
            // Return the most recent value
            const latestValue = values[values.length - 1];
            return latestValue.value || 0;
        }
        // If no historical data, try current value
        const currentResult = activeRuntime.devices.getTagValue(tagName, true);
        return currentResult ? currentResult.value : 0;
    }
    catch (error) {
        console.error(`Error getting DAQ data for ${tagName}:`, error);
        return 0;
    }
}
function app() {
    const pdfmeApp = express();
    pdfmeApp.use(express.json({ limit: '50mb' }));
    pdfmeApp.use(express.urlencoded({ limit: '50mb', extended: true }));
    // Serve static files for pdfme React app
    const pdfmeDistPath = path.join(__dirname, '..', 'react', 'pdfme', 'dist');
    if (fs.existsSync(pdfmeDistPath)) {
        pdfmeApp.use('/api/pdfme-static', express.static(pdfmeDistPath));
    }
    // GET /api/pdfme/templates - List templates
    pdfmeApp.get('/api/pdfme/templates', (req, res) => {
        try {
            const templatesDir = path.join(runtime.settings.appDir, '_reports', 'templates');
            if (!fs.existsSync(templatesDir)) {
                return res.json([]);
            }
            const templates = fs.readdirSync(templatesDir)
                .filter(dir => fs.statSync(path.join(templatesDir, dir)).isDirectory())
                .map(dir => {
                const templatePath = path.join(templatesDir, dir, 'template.json');
                if (fs.existsSync(templatePath)) {
                    const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
                    return {
                        id: dir,
                        name: template.name || dir,
                        thumbnail: `/api/pdfme/templates/${dir}/thumbnail.png`
                    };
                }
                return null;
            })
                .filter(Boolean);
            res.json(templates);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // GET /api/pdfme/templates/:id - Get template data
    pdfmeApp.get('/api/pdfme/templates/:id', (req, res) => {
        try {
            const templatePath = path.join(runtime.settings.appDir, '_reports', 'templates', req.params.id, 'template.json');
            if (!fs.existsSync(templatePath)) {
                return res.status(404).json({ error: 'Template not found' });
            }
            const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
            res.json({ template });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // GET /api/pdfme/templates/:id/thumbnail.png - Serve thumbnail
    pdfmeApp.get('/api/pdfme/templates/:id/thumbnail.png', (req, res) => {
        const thumbnailPath = path.join(runtime.settings.appDir, '_reports', 'templates', req.params.id, 'thumbnail.png');
        if (fs.existsSync(thumbnailPath)) {
            res.sendFile(thumbnailPath);
        }
        else {
            res.status(404).end();
        }
    });
    // POST /api/pdfme/templates - Save template
    pdfmeApp.post('/api/pdfme/templates', (req, res) => {
        try {
            const { id, template } = req.body;
            const templateDir = path.join(runtime.settings.appDir, '_reports', 'templates', id);
            if (!fs.existsSync(templateDir)) {
                fs.mkdirSync(templateDir, { recursive: true });
            }
            const filePath = path.join(templateDir, 'template.json');
            fs.writeFileSync(filePath, JSON.stringify(template, null, 2));
            res.json({ success: true });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // POST /api/pdfme/generate-pdf - Generate PDF
    pdfmeApp.post('/api/pdfme/generate-pdf', async (req, res) => {
        try {
            const { template, inputs, options, savePath, reportName, isDynamicReport, tableConfigs } = req.body;
            // Validate required parameters
            if (!template) {
                return res.status(400).json({ error: 'Template is required' });
            }
            // Process the template to ensure basePdf is valid
            let processedTemplate = { ...template };
            // Ensure schemas exist
            if (!processedTemplate.schemas) {
                processedTemplate.schemas = [[]];
            }
            // Set default basePdf if not provided
            if (!processedTemplate.basePdf) {
                processedTemplate.basePdf = {
                    width: 210, // A4 width in mm
                    height: 297, // A4 height in mm
                    padding: [0, 0, 0, 0] // No padding for blank PDF
                };
            }
            // Ensure inputs is not empty - pdfme requires at least one input object
            let processedInputs = inputs || [];
            if (processedInputs.length === 0) {
                processedInputs = [{}]; // Add empty object as minimum requirement
            }
            // If this is a dynamic report, process live data
            if (isDynamicReport) {
                const result = await processDynamicData(processedTemplate, processedInputs, tableConfigs || []);
                processedTemplate = result.template;
                processedInputs = result.inputs;
            }
            // Plugins as object with plugin names as keys
            const plugins = { text, multiVariableText, image, svg, line, table, rectangle, ellipse, dateTime, date, time, select, checkbox, radioGroup, signature, qrcode: barcodes.qrcode, ean13: barcodes.ean13, code128: barcodes.code128 };
            const pdf = await generate({
                template: processedTemplate,
                inputs: processedInputs,
                plugins,
                options: options || {}
            });
            // Use custom save path or default to _reports/generated
            const defaultDir = path.join(runtime.settings.appDir, '_reports', 'generated');
            const targetDir = savePath ? path.join(runtime.settings.appDir, savePath) : defaultDir;
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }
            // Generate filename with report name, date in dd/mm/yyyy format, and handle duplicates
            const now = new Date();
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const year = now.getFullYear();
            const dateStr = `${day}-${month}-${year}`;
            const baseName = reportName ? `${reportName}_${dateStr}` : `report_${dateStr}`;
            let fileName = `${baseName}.pdf`;
            let counter = 1;
            let filePath = path.join(targetDir, fileName);
            // Check for existing files and append number if needed
            while (fs.existsSync(filePath)) {
                fileName = `${baseName}_${counter}.pdf`;
                filePath = path.join(targetDir, fileName);
                counter++;
            }
            fs.writeFileSync(filePath, pdf);
            res.json({ fileName, path: filePath, success: true });
        }
        catch (err) {
            console.error('PDF generation error:', err);
            console.error('Full error message:', err.message);
            res.status(500).json({ error: err.message });
        }
    });
    // POST /api/pdfme/save-config - Save config
    pdfmeApp.post('/api/pdfme/save-config', (req, res) => {
        try {
            const { id, config } = req.body;
            const configsDir = path.join(runtime.settings.appDir, '_reports', 'configs');
            if (!fs.existsSync(configsDir)) {
                fs.mkdirSync(configsDir, { recursive: true });
            }
            const filePath = path.join(configsDir, `${id}.json`);
            fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
            res.json({ success: true });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // POST /api/pdfme/configs - Save config
    pdfmeApp.post('/api/pdfme/configs', (req, res) => {
        try {
            const config = req.body;
            const configsDir = path.join(runtime.settings.appDir, '_reports', 'configs');
            if (!fs.existsSync(configsDir)) {
                fs.mkdirSync(configsDir, { recursive: true });
            }
            const filePath = path.join(configsDir, `${config.id}.json`);
            fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
            res.json({ success: true });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // GET /api/pdfme/configs/:id - Load config
    pdfmeApp.get('/api/pdfme/configs/:id', (req, res) => {
        try {
            const filePath = path.join(runtime.settings.appDir, '_reports', 'configs', `${req.params.id}.json`);
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'Config not found' });
            }
            const config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            res.json(config);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    return pdfmeApp;
}
module.exports = {
    init: init,
    app: app,
    processDynamicData: processDynamicData
};
