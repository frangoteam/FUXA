"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvancedReportsApiService = void 0;
const authJwt = require('../../api/jwt-helper');
const fs = require('fs');
const path = require('path');
const express_1 = __importDefault(require("express"));
const generator_1 = require("@pdfme/generator");
const schemas_1 = require("@pdfme/schemas");
class AdvancedReportsApiService {
    init(_runtime, _secureFnc, _checkGroupsFnc) {
        this.runtime = _runtime;
        this.secureFnc = _secureFnc;
        this.checkGroupsFnc = _checkGroupsFnc;
        // Listen for tag changes to trigger automatic report generation
        this.runtime.events.on('tag-value:changed', this.onTagChanged.bind(this));
    }
    app() {
        var advancedReportsApp = (0, express_1.default)();
        advancedReportsApp.use((req, res, next) => {
            if (!this.runtime.project) {
                res.status(404).end();
            }
            else {
                next();
            }
        });
        /**
         * GET advanced reports
         */
        advancedReportsApp.get('/api/advanced-reports', this.secureFnc, (req, res) => {
            var groups = this.checkGroupsFnc(req);
            if (res.statusCode === 403) {
                this.runtime.logger.error('api get advanced-reports: Token Expired');
            }
            else {
                try {
                    const reportsPath = path.join(this.runtime.settings.appDir, 'reports.json');
                    if (!fs.existsSync(reportsPath)) {
                        res.json([]);
                        return;
                    }
                    const reports = JSON.parse(fs.readFileSync(reportsPath, 'utf8'));
                    res.json(reports);
                }
                catch (err) {
                    if (err instanceof Error) {
                        res.status(400).json({ error: err.stack, message: err.message });
                    }
                    else {
                        res.status(400).json({ error: 'unexpected_error', message: err });
                    }
                    this.runtime.logger.error('api get advanced-reports: ' + err);
                }
            }
        });
        /**
         * POST save advanced report
         */
        advancedReportsApp.post('/api/advanced-reports', this.secureFnc, (req, res) => {
            var groups = this.checkGroupsFnc(req);
            if (res.statusCode === 403) {
                this.runtime.logger.error('api post advanced-reports: Token Expired');
            }
            else if (authJwt.adminGroups.indexOf(groups) === -1) {
                res.status(401).json({ error: "unauthorized_error", message: "Unauthorized!" });
                this.runtime.logger.error("api post advanced-reports: Unauthorized");
            }
            else {
                try {
                    const reportsPath = path.join(this.runtime.settings.appDir, 'reports.json');
                    let reports = [];
                    if (fs.existsSync(reportsPath)) {
                        reports = JSON.parse(fs.readFileSync(reportsPath, 'utf8'));
                    }
                    const report = req.body;
                    const existingIndex = reports.findIndex((r) => r.id === report.id);
                    if (existingIndex >= 0) {
                        reports[existingIndex] = report;
                    }
                    else {
                        reports.push(report);
                    }
                    fs.writeFileSync(reportsPath, JSON.stringify(reports, null, 2));
                    res.json({ success: true });
                }
                catch (err) {
                    if (err instanceof Error) {
                        res.status(400).json({ error: err.stack, message: err.message });
                    }
                    else {
                        res.status(400).json({ error: 'unexpected_error', message: err });
                    }
                    this.runtime.logger.error('api post advanced-reports: ' + err);
                }
            }
        });
        /**
         * DELETE advanced report
         */
        advancedReportsApp.delete('/api/advanced-reports/:id', this.secureFnc, (req, res) => {
            var groups = this.checkGroupsFnc(req);
            if (res.statusCode === 403) {
                this.runtime.logger.error('api delete advanced-reports: Token Expired');
            }
            else if (authJwt.adminGroups.indexOf(groups) === -1) {
                res.status(401).json({ error: "unauthorized_error", message: "Unauthorized!" });
                this.runtime.logger.error("api delete advanced-reports: Unauthorized");
            }
            else {
                try {
                    const reportsPath = path.join(this.runtime.settings.appDir, 'reports.json');
                    if (fs.existsSync(reportsPath)) {
                        let reports = JSON.parse(fs.readFileSync(reportsPath, 'utf8'));
                        reports = reports.filter((r) => r.id !== req.params.id);
                        fs.writeFileSync(reportsPath, JSON.stringify(reports, null, 2));
                    }
                    res.json({ success: true });
                }
                catch (err) {
                    if (err instanceof Error) {
                        res.status(400).json({ error: err.stack, message: err.message });
                    }
                    else {
                        res.status(400).json({ error: 'unexpected_error', message: err });
                    }
                    this.runtime.logger.error('api delete advanced-reports: ' + err);
                }
            }
        });
        /**
         * POST generate advanced report
         */
        advancedReportsApp.post('/api/advanced-reports/generate/:id', this.secureFnc, async (req, res) => {
            var groups = this.checkGroupsFnc(req);
            if (res.statusCode === 403) {
                this.runtime.logger.error('api post advanced-reports generate: Token Expired');
            }
            else {
                try {
                    const reportsPath = path.join(this.runtime.settings.appDir, 'reports.json');
                    if (!fs.existsSync(reportsPath)) {
                        res.status(404).json({ error: 'Report not found' });
                        return;
                    }
                    const reports = JSON.parse(fs.readFileSync(reportsPath, 'utf8'));
                    const report = reports.find((r) => r.id === req.params.id);
                    if (!report) {
                        res.status(404).json({ error: 'Report not found' });
                        return;
                    }
                    // Prepare inputs
                    const inputs = await this.prepareInputs(report);
                    // Generate PDF
                    const plugins = {
                        text: schemas_1.text,
                        table: schemas_1.table,
                        image: schemas_1.image,
                        qrcode: schemas_1.barcodes.qrcode
                    };
                    const pdf = await (0, generator_1.generate)({
                        template: report.template,
                        inputs,
                        plugins
                    });
                    // Save PDF
                    const reportsDir = this.runtime.settings.reportsDir;
                    if (!fs.existsSync(reportsDir)) {
                        fs.mkdirSync(reportsDir, { recursive: true });
                    }
                    const fileName = `${report.name}_${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
                    const filePath = path.join(reportsDir, fileName);
                    fs.writeFileSync(filePath, pdf);
                    // Send email if configured
                    if (report.settings.emails && report.settings.emails.length > 0) {
                        await this.sendEmail(report.settings.emails, filePath, report.name);
                    }
                    res.json({ fileName, path: filePath });
                }
                catch (err) {
                    if (err instanceof Error) {
                        res.status(400).json({ error: err.stack, message: err.message });
                    }
                    else {
                        res.status(400).json({ error: 'unexpected_error', message: err });
                    }
                    this.runtime.logger.error('api post advanced-reports generate: ' + err);
                }
            }
        });
        /**
         * POST preview advanced report
         */
        advancedReportsApp.post('/api/advanced-reports/preview', this.secureFnc, async (req, res) => {
            var groups = this.checkGroupsFnc(req);
            if (res.statusCode === 403) {
                this.runtime.logger.error('api post advanced-reports preview: Token Expired');
            }
            else {
                try {
                    const { template, settings } = req.body;
                    // Create a temporary report object for preview
                    const previewReport = {
                        template,
                        settings
                    };
                    // Prepare inputs
                    const inputs = await this.prepareInputs(previewReport);
                    // Generate PDF
                    const plugins = {
                        text: schemas_1.text,
                        table: schemas_1.table,
                        image: schemas_1.image,
                        qrcode: schemas_1.barcodes.qrcode
                    };
                    const pdf = await (0, generator_1.generate)({
                        template,
                        inputs,
                        plugins
                    });
                    // Return PDF as response
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', 'inline; filename="preview.pdf"');
                    res.send(Buffer.from(pdf));
                }
                catch (err) {
                    if (err instanceof Error) {
                        res.status(400).json({ error: err.stack, message: err.message });
                    }
                    else {
                        res.status(400).json({ error: 'unexpected_error', message: err });
                    }
                    this.runtime.logger.error('api post advanced-reports preview: ' + err);
                }
            }
        });
        /**
         * GET pdfme designer
         */
        advancedReportsApp.get('/api/pdfme-designer', (req, res) => {
            const designerPath = path.join(__dirname, '../../api/advanced-reports/pdfme-designer.html');
            if (fs.existsSync(designerPath)) {
                res.sendFile(designerPath);
            }
            else {
                res.status(404).send('Designer not found');
            }
        });
        /**
         * Serve pdfme static files
         */
        advancedReportsApp.get('/api/pdfme-static/@pdfme/ui/index.umd.js', (req, res) => {
            const filePath = path.join(__dirname, '../../node_modules/@pdfme/ui/dist/index.umd.js');
            if (fs.existsSync(filePath)) {
                res.sendFile(filePath);
            }
            else {
                res.status(404).send('File not found');
            }
        });
        advancedReportsApp.get('/api/pdfme-static/react/umd/react.development.js', (req, res) => {
            const filePath = path.join(__dirname, '../../node_modules/react/umd/react.development.js');
            if (fs.existsSync(filePath)) {
                res.sendFile(filePath);
            }
            else {
                res.status(404).send('File not found');
            }
        });
        advancedReportsApp.get('/api/pdfme-static/react-dom/umd/react-dom.development.js', (req, res) => {
            const filePath = path.join(__dirname, '../../node_modules/react-dom/umd/react-dom.development.js');
            if (fs.existsSync(filePath)) {
                res.sendFile(filePath);
            }
            else {
                res.status(404).send('File not found');
            }
        });
        return advancedReportsApp;
    }
    async prepareInputs(report) {
        const inputs = {};
        // Populate text fields from tags
        for (const [key, schema] of Object.entries(report.template.schemas[0] || {})) {
            const schemaObj = schema;
            if (schemaObj.type === 'text' && key !== 'mytable') { // Skip table for now
                const tagValue = this.getTagValue(key);
                inputs[key] = tagValue !== null ? tagValue.toString() : '';
            }
        }
        // Handle table data
        if (report.settings.tableSource) {
            const tableData = await this.getTableData(report.settings.tableSource);
            inputs[report.settings.tableSource.tableName || 'mytable'] = tableData;
        }
        return [inputs];
    }
    getTagValue(tagId) {
        // Get tag value from runtime
        const tag = this.runtime.devices.getTag(tagId);
        return tag ? tag.value : null;
    }
    async getTableData(tableSource) {
        if (tableSource.type === 'daq') {
            // Query DAQ history
            const tags = tableSource.tags || [];
            const range = tableSource.range || 'daily';
            // This would need to be implemented based on existing DAQ logic
            // For now, return sample data
            return [
                ['Sample', 'Data', 'Row 1'],
                ['Sample', 'Data', 'Row 2']
            ];
        }
        else if (tableSource.type === 'raw') {
            // Parse JSON from tag
            const jsonTag = this.getTagValue(tableSource.jsonTag);
            if (jsonTag && typeof jsonTag === 'string') {
                try {
                    return JSON.parse(jsonTag);
                }
                catch (e) {
                    this.runtime.logger.error('Failed to parse table JSON: ' + e);
                    return [];
                }
            }
        }
        return [];
    }
    async sendEmail(emails, filePath, reportName) {
        // Use existing notification system
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransporter({
            // Configure based on existing settings
            host: this.runtime.settings.smtp?.host || 'localhost',
            port: this.runtime.settings.smtp?.port || 587,
            secure: false,
            auth: {
                user: this.runtime.settings.smtp?.user,
                pass: this.runtime.settings.smtp?.pass
            }
        });
        const mailOptions = {
            from: this.runtime.settings.smtp?.from || 'fuxa@localhost',
            to: emails.join(','),
            subject: `FUXA Advanced Report: ${reportName}`,
            text: `Please find attached the generated report: ${reportName}`,
            attachments: [{
                    filename: path.basename(filePath),
                    path: filePath
                }]
        };
        await transporter.sendMail(mailOptions);
    }
    async onTagChanged(tagEvent) {
        try {
            const reportsPath = path.join(this.runtime.settings.appDir, 'reports.json');
            if (!fs.existsSync(reportsPath)) {
                return;
            }
            const reports = JSON.parse(fs.readFileSync(reportsPath, 'utf8'));
            const tagId = tagEvent.id;
            // Find reports that should be triggered by this tag change
            const triggeredReports = reports.filter((report) => report.triggerTags && report.triggerTags.includes(tagId));
            for (const report of triggeredReports) {
                try {
                    this.runtime.logger.info(`Triggering automatic report generation for: ${report.name}`);
                    // Generate the report
                    const pdfBuffer = await this.generateReport(report);
                    // Save the PDF
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const fileName = `${report.name.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.pdf`;
                    const filePath = path.join(this.runtime.settings.appDir, '_reports', fileName);
                    // Ensure _reports directory exists
                    const reportsDir = path.dirname(filePath);
                    if (!fs.existsSync(reportsDir)) {
                        fs.mkdirSync(reportsDir, { recursive: true });
                    }
                    fs.writeFileSync(filePath, pdfBuffer);
                    // Send email if configured
                    if (report.emailSettings && report.emailSettings.emails && report.emailSettings.emails.length > 0) {
                        await this.sendEmail(report.emailSettings.emails, filePath, report.name);
                        this.runtime.logger.info(`Email sent for triggered report: ${report.name}`);
                    }
                    this.runtime.logger.info(`Automatic report generated: ${fileName}`);
                }
                catch (error) {
                    this.runtime.logger.error(`Error generating triggered report ${report.name}: ${error.message}`);
                }
            }
        }
        catch (error) {
            this.runtime.logger.error(`Error in onTagChanged: ${error.message}`);
        }
    }
    async generateReport(report) {
        // Prepare inputs
        const inputs = await this.prepareInputs(report);
        // Generate PDF
        const plugins = {
            text: schemas_1.text,
            table: schemas_1.table,
            image: schemas_1.image,
            qrcode: schemas_1.barcodes.qrcode
        };
        const pdf = await (0, generator_1.generate)({
            template: report.template,
            inputs,
            plugins
        });
        return Buffer.from(pdf);
    }
}
exports.AdvancedReportsApiService = AdvancedReportsApiService;
