const authJwt = require('../../api/jwt-helper');
const fs = require('fs');
const path = require('path');
const schedule = require('node-schedule');
const { processDynamicData, init: initPdfme } = require('../../api/pdfme/index');
import express, { Request, Response } from 'express';
import { generate } from '@pdfme/generator';
import { text, multiVariableText, barcodes, image, svg, line, table, rectangle, ellipse, dateTime, date, time, select, checkbox, radioGroup } from '@pdfme/schemas';
import { Dirent } from 'fs';

// Custom signature plugin that uses image.pdf for rendering
const signature = {
  ui: () => {}, // Dummy UI for server-side
  pdf: image.pdf,
  propPanel: {
    schema: {},
    defaultSchema: {
      name: '',
      type: 'signature',
      content: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAPoAAACWCAMAAADABGUuAAAAM1BMVEVHcEwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADbQS4qAAAAEXRSTlMAQoQeYeiWCBJy08CqUjUp+0wCxwEAAAehSURBVHja7V3ZkqMwDMT3ffz/147M6RAg5CYj/LA7VTuVIFottWVZ2zTnes9SaC1PMiC1nElLkXo75dLgNN0Y5nA6PJE6OoaT6LGhHmOI1zQ02nGMIc5AgAso/T1Q3SiPMbURsLwhliBUcRQ8XUmEQY6ZVJC3+JK64sXRlUcIemjRDgIf6JEXtLXDB7o2uhXwAl9457GFXkh8Gb1luHY24ctrnbtng9bdvUYX3Tt39yKii+5ct7u2jG+zGtqERgS+lM5aMZMsvujexTjlEYqZDnSMeU2F1O5aEG7Y2sSWLMJ6nOKszegIi1IFdCUFwvJzC7oRKGuwodUyGiHohuEMcQA4hxBnY4MSdAhxKE+UAXSDMbgX0BMRVOEEPVqpcYJOPM7+iSYa6RJKyxvjMR4nl5WcxdoZSAXS7jjQrxRpK6ySONNaiXFI0xrOtpEhunuk7q6l5zgtV8ZQpEwPJiAFndCuQ+4z3NIHUg+JMvIpHae5O5By0jQ2m6Anzl8U/RXxwmZxlLCiTIDd6joQjFqRX1OWT1L4QLM9ShoNYLZZLcEqbi0l1ulX+Lq1XEV7mFaNSDWQXa3meyFTo/wLgIpActZon+VBqM4osNyQ1cd15axduadNB+/xxbVMPspWQRerGdUrUcDK9jm1e9bhk3ShgE3EYU5weeEdX964RN89Lrwb8ZyTQkbrxCJzhyE6KZFdL4KujZODa5KnIrwKXsa+JHAYorf3O5pFDTtBXtziGayi9MMnBXEYotPY/skWIPe1iqGPN00yI8PwSckepfmyaJk2ry8AZerXAbmNPUpyOhpe8tpRiB5aCadouspD8hIcbR9rplKE1r5jDkR03UW6q0xvZmEvPtZekszFzoAIeyiiA+hx7uxhjg1/5NhZBUrqD2LuKBm9Jzro2BkL5PUDUnH/Zj7Sy92eojeaL1U0/DN86DPaDHTFF8K9ul/LQXibOVPY7kxixov8GbeIvYyJFxsXbczC87G7b/4QOt/gb3dZM26zdTmHjxA99aCTiwAXllyO3El1beaQly7rsCVzhTPM5E9k/YHoENN07QnLDmfueyQir2s6fP0gU4HhviR/mT/RjzxKVxpqL122UPl7qA7q7fpjol0levTCtZlA2080oceB0RXokItWsq6+ZybNEuSlES+tccO6Xu4l8QF/14PSUJRPbmdWcdnfRrcIOTBmpVdDBefGN8Xz3Lk04cvB5wmik9HZ9Pg21nMq3y3CFiEv7s5XfN1WnkZnVGfGivziCua0Rx1HDGm6oSakfApycPfFyl+iXcVq/JoLhQ/BD+z28qUqZyR6M87ZYXTDpdnOwSxErlCGLoU4bZy/0LmAuqzrWTl78uJjGj1tKQbQE91SUWGXv+sVyMtgl7RN8ivTVTKgcF6vavlo5gB6pJuRddcgolXI4VvI9V7Wu6tfVz47TlIkoZW0bzj3JVNM70EndHNvssffAfI1v2HeXNdB7FJdyOacBazyl3xDmkvT2yadI4Yb73eHv69D3mg5r04w6pYNA1FXlnWSpzeouoroSrZChdPt7KG8fBxyEA6zMiTI9Vl0q/6NxZgYe9N53ET0DvQNITPm5PAw5FfDTcBwx79z1DgRvQNdGXPLteS2ptiCvGT0OkRCWC/nd19ZrMKngL7Dcm3lw5CX/RqpijBe2PClsqTmqaIwBQl303Lw2A1QGfWbZZV6ok2SQnyvUakiegF9U7yOSX3d31XwN0LkNNEG9Hh23ytKVkQvoDO5Q59u+Hs5Or3xhcNVaCB5tuZ7nRQ10QH0sMdyePqwFt6ms8hVd+9AB+2Wvxbe5kQvs8R2Wb5ahSbO3YxYffE5SpEd+eapS010AHPfbkwvN1MkaW+j2N38h+gGG5Gvdg2ROqRtlkcvSLJUhe6agW4qZmtJCvI9G5EHpXtzR3F56ReJ30VcnkUpsrxlI/KgdG8B2XuicF2FTnSnLmHSCuFo/PLRqrogenJ7T9CuWsa0sULu9F+l37YTeTCjN8nvkaaUb2kZ/db1+AuiJ683H05PdRUL+n5y7H6OaInH+Te1gZIBKkyHDT4j935vCB69GH/JOAkXP+SdADD5c9NMgihxpzfcYBGwMGZ1ilQW5LUz93+q4kePYdUvftMjznIy7Y9AqG/ZzgQndWYX/D3tu20VAqdDL94IagmOiu3ue4cnqdZZD96+61qAWXeqNKjiuRiU3Wto7W8iYdpXXt7dWK0U8v2tPPiSO8fLzVdaOktTzbjmMfA+WR5p+BMdiiu7JKR6Fp2J9za4ZgWORFdSd/9GDKKWcB6JLoaR818pjHt+0QfpLuiw34lWRT+PhJd0bEEybNAMGmIDWVQNU1QUx6Dv+uxL8hMG7UoMIhYPjSq8epqnsHg73EI6XX7PSR1++/1TN8lM7tQxwQC00lvMLF1sx6YLv77rk31nWrRXlSdD3Sd9H3liQ70NL9bxf79cNj+v1lkbn6aqv1/9/dufhhbuD7634Mcs6ZFOBt0U/NMuWUCluObF8jKFZ0DDQH5MOjAc4Sj45iVTQLLEc5PMyJGlzEOANbOlo5MjKOPWbk9gXPoc7k/IrHOSZQB6fzfc53rXOc617nOda5zrXkdcfnDY89MrTC6UAAAAASUVORK5CYII=',
      position: { x: 0, y: 0 },
      width: 62.5,
      height: 37.5,
    },
  },
};

export class AdvancedReportsApiService {

    runtime: any;
    secureFnc: any;
    checkGroupsFnc: any;

    // Track trigger tag states for rising edge detection
    private triggerTagStates: Map<string, any> = new Map();

    // Track scheduled jobs for advanced reports
    private scheduledJobs: Map<string, any> = new Map();

    init(_runtime: any, _secureFnc: any, _checkGroupsFnc: any) {
        this.runtime = _runtime;
        this.secureFnc = _secureFnc;
        this.checkGroupsFnc = _checkGroupsFnc;

        // Listen for tag changes to trigger automatic report generation
        this.runtime.events.on('tag-value:changed', this.onTagChanged.bind(this));

        // Subscribe to existing trigger tags
        this.subscribeToTriggerTags();

        // Sync default templates to ensure they're available for users
        this.syncDefaultTemplates();

        // Load scheduled reports after a short delay to ensure FUXA is fully initialized
        setTimeout(() => {
            this.loadScheduledReports();
        }, 3000); // 3 second delay
    }

    private syncDefaultTemplates() {
        try {
            const sourceDir = path.join(this.runtime.settings.appDir, 'react', 'pdfme', 'public', 'template-assets');
            const destDir = path.join(this.runtime.settings.reportsDir, 'templates');

            // Check if source directory exists
            if (!fs.existsSync(sourceDir)) {
                console.log('Default templates source directory not found:', sourceDir);
                return;
            }

            // Ensure destination directory exists
            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
                console.log('Created templates directory:', destDir);
            }

            // Get list of default templates
            const defaultTemplates = fs.readdirSync(sourceDir, { withFileTypes: true })
                .filter((dirent: Dirent) => dirent.isDirectory())
                .map((dirent: Dirent) => dirent.name);

            console.log(`Found ${defaultTemplates.length} default templates to check`);

            // Check each default template
            for (const templateName of defaultTemplates) {
                const sourceTemplateDir = path.join(sourceDir, templateName);
                const destTemplateDir = path.join(destDir, templateName);

                // Check if template already exists in user templates
                if (!fs.existsSync(destTemplateDir)) {
                    try {
                        // Copy the entire template directory
                        this.copyDirectoryRecursive(sourceTemplateDir, destTemplateDir);
                        console.log(`Copied default template: ${templateName}`);
                    } catch (error) {
                        console.error(`Failed to copy template ${templateName}:`, error);
                    }
                } else {
                    console.log(`Template ${templateName} already exists, skipping`);
                }
            }

            console.log('Default template synchronization completed');
        } catch (error) {
            console.error('Error during default template synchronization:', error);
        }
    }

    private copyDirectoryRecursive(source: string, destination: string) {
        // Create destination directory
        fs.mkdirSync(destination, { recursive: true });

        // Copy all files and subdirectories
        const items = fs.readdirSync(source, { withFileTypes: true });

        for (const item of items) {
            const sourcePath = path.join(source, item.name);
            const destPath = path.join(destination, item.name);

            if ((item as Dirent).isDirectory()) {
                // Recursively copy subdirectory
                this.copyDirectoryRecursive(sourcePath, destPath);
            } else {
                // Copy file
                fs.copyFileSync(sourcePath, destPath);
            }
        }
    }

    private subscribeToTriggerTags() {
        try {
            // Load traditional reports
            const reportsPath = path.join(this.runtime.settings.appDir, 'reports.json');
            let traditionalReports: any[] = [];
            if (fs.existsSync(reportsPath)) {
                traditionalReports = JSON.parse(fs.readFileSync(reportsPath, 'utf8'));
            }

            // Load advanced reports
            const configsDir = path.join(this.runtime.settings.reportsDir, 'configs');
            let advancedReports: any[] = [];
            if (fs.existsSync(configsDir)) {
                const configFiles = fs.readdirSync(configsDir).filter((file: string) => file.endsWith('.json'));
                for (const file of configFiles) {
                    try {
                        const configPath = path.join(configsDir, file);
                        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                        advancedReports.push(config);
                    } catch (err) {
                        console.error('Error loading config file:', file, err);
                    }
                }
            }

            // Combine all reports
            const allReports = [...traditionalReports, ...advancedReports];

            // Collect all unique trigger tags
            const triggerTags = new Set<string>();
            for (const report of allReports) {
                // Check old format (triggerTags array)
                if (report.triggerTags && Array.isArray(report.triggerTags)) {
                    report.triggerTags.forEach((tag: string) => triggerTags.add(tag));
                }
                // Check new format (single triggerTag)
                if (report.triggerTag) {
                    triggerTags.add(report.triggerTag);
                }
            }

            // Subscribe to each trigger tag
            triggerTags.forEach(tagId => {
                this.runtime.events.emit('tag-change:subscription', tagId);
            });

        } catch (error) {
            console.error('Error subscribing to trigger tags:', error);
        }
    }

    app() {
        var advancedReportsApp = express();
        advancedReportsApp.use((req, res, next) => {
            if (!this.runtime.project) {
                res.status(404).end();
            } else {
                next();
            }
        });

        /**
         * GET advanced reports
         */
        advancedReportsApp.get('/api/advanced-reports', this.secureFnc, (req: Request, res: Response) => {
            var groups = this.checkGroupsFnc(req);
            if (res.statusCode === 403) {
                this.runtime.logger.error('api get advanced-reports: Token Expired');
            } else {
                try {
                    let reports: any[] = [];

                    // Load traditional reports from reports.json
                    const reportsPath = path.join(this.runtime.settings.appDir, 'reports.json');
                    if (fs.existsSync(reportsPath)) {
                        const traditionalReports = JSON.parse(fs.readFileSync(reportsPath, 'utf8'));
                        reports = reports.concat(traditionalReports);
                    }

                    // Load pdfme advanced reports from _reports/configs
                    const configsDir = path.join(this.runtime.settings.reportsDir, 'configs');
                    if (fs.existsSync(configsDir)) {
                        const configFiles = fs.readdirSync(configsDir).filter((file: string) => file.endsWith('.json'));
                        for (const file of configFiles) {
                            try {
                                const configPath = path.join(configsDir, file);
                                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                                // Convert pdfme config to report format
                                reports.push({
                                    id: config.id,
                                    name: config.name,
                                    type: config.type || 'advanced',
                                    pdfmeData: config.pdfmeData,
                                    tableConfigs: config.tableConfigs,
                                    triggerTag: config.triggerTag,
                                    scheduling: config.scheduling,
                                    emailSettings: config.emailSettings,
                                    saveToDisk: config.saveToDisk,
                                    createdAt: config.createdAt
                                });
                            } catch (err) {
                                console.error('Error loading config file:', file, err);
                            }
                        }
                    }

                    res.json(reports);
                } catch (err) {
                    if (err instanceof Error) {
                        res.status(400).json({error: err.stack, message: err.message});
                    } else {
                        res.status(400).json({error:'unexpected_error', message: err});
                    }
                    this.runtime.logger.error('api get advanced-reports: ' + err);
                }
            }
        });

        /**
         * POST save advanced report
         */
        advancedReportsApp.post('/api/advanced-reports', this.secureFnc, (req: Request, res: Response) => {
            var groups = this.checkGroupsFnc(req);
            if (res.statusCode === 403) {
                this.runtime.logger.error('api post advanced-reports: Token Expired');
            } else if (authJwt.adminGroups.indexOf(groups) === -1 ) {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                this.runtime.logger.error("api post advanced-reports: Unauthorized");
            } else {
                try {
                    const reportsPath = path.join(this.runtime.settings.appDir, 'reports.json');
                    let reports = [];
                    if (fs.existsSync(reportsPath)) {
                        reports = JSON.parse(fs.readFileSync(reportsPath, 'utf8'));
                    }
                    const report = req.body;
                    const existingIndex = reports.findIndex((r: any) => r.id === report.id);
                    if (existingIndex >= 0) {
                        reports[existingIndex] = report;
                    } else {
                        reports.push(report);
                    }
                    fs.writeFileSync(reportsPath, JSON.stringify(reports, null, 2));
                    res.json({ success: true });
                } catch (err) {
                    if (err instanceof Error) {
                        res.status(400).json({error: err.stack, message: err.message});
                    } else {
                        res.status(400).json({error:'unexpected_error', message: err});
                    }
                    this.runtime.logger.error('api post advanced-reports: ' + err);
                }
            }
        });

        /**
         * POST test generate advanced report
         */
        advancedReportsApp.post('/api/advanced-reports/test-generate', this.secureFnc, async (req: Request, res: Response) => {
            var groups = this.checkGroupsFnc(req);
            if (res.statusCode === 403) {
                this.runtime.logger.error('api post advanced-reports test-generate: Token Expired');
            } else if (authJwt.adminGroups.indexOf(groups) === -1 ) {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                this.runtime.logger.error("api post advanced-reports test-generate: Unauthorized");
            } else {
                try {
                    const reportId = req.body.id;
                    
                    // Load the saved configuration from file to ensure consistency with tag triggers
                    const configPath = path.join(this.runtime.settings.reportsDir, 'configs', `${reportId}.json`);
                    if (!fs.existsSync(configPath)) {
                        throw new Error(`Report configuration not found: ${reportId}`);
                    }
                    
                    const report = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                    
                    // Simply call the same method that trigger tags use
                    await this.generatePdfFromTemplate(report);
                    
                    res.json({ success: true, message: 'Test report generated successfully' });
                } catch (err) {
                    if (err instanceof Error) {
                        res.status(400).json({error: err.stack, message: err.message});
                    } else {
                        res.status(400).json({error:'unexpected_error', message: err});
                    }
                    this.runtime.logger.error('api post advanced-reports test-generate: ' + err);
                }
            }
        });

        /**
         * DELETE advanced report
         */
        advancedReportsApp.delete('/api/advanced-reports/:id', this.secureFnc, (req: Request, res: Response) => {
            var groups = this.checkGroupsFnc(req);
            if (res.statusCode === 403) {
                this.runtime.logger.error('api delete advanced-reports: Token Expired');
            } else if (authJwt.adminGroups.indexOf(groups) === -1 ) {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                this.runtime.logger.error("api delete advanced-reports: Unauthorized");
            } else {
                try {
                    const reportId = req.params.id;
                    let deleted = false;

                    // Try to delete from traditional reports.json
                    const reportsPath = path.join(this.runtime.settings.appDir, 'reports.json');
                    if (fs.existsSync(reportsPath)) {
                        let reports = JSON.parse(fs.readFileSync(reportsPath, 'utf8'));
                        const initialLength = reports.length;
                        reports = reports.filter((r: any) => r.id !== reportId);
                        if (reports.length < initialLength) {
                            fs.writeFileSync(reportsPath, JSON.stringify(reports, null, 2));
                            deleted = true;
                        }
                    }

                    // Try to delete from _reports/configs directory
                    const configsDir = path.join(this.runtime.settings.reportsDir, 'configs');
                    const configFile = path.join(configsDir, `${reportId}.json`);
                    if (fs.existsSync(configFile)) {
                        fs.unlinkSync(configFile);
                        deleted = true;
                    }

                    if (deleted) {
                        res.json({ success: true });
                    } else {
                        res.status(404).json({ error: 'Report not found' });
                    }
                } catch (err) {
                    if (err instanceof Error) {
                        res.status(400).json({error: err.stack, message: err.message});
                    } else {
                        res.status(400).json({error:'unexpected_error', message: err});
                    }
                    this.runtime.logger.error('api delete advanced-reports: ' + err);
                }
            }
        });

        /**
         * POST generate advanced report
         */
        advancedReportsApp.post('/api/advanced-reports/generate/:id', this.secureFnc, async (req: Request, res: Response) => {
            var groups = this.checkGroupsFnc(req);
            if (res.statusCode === 403) {
                this.runtime.logger.error('api post advanced-reports generate: Token Expired');
            } else {
                try {
                    const configId = req.params.id;
                    const configsDir = path.join(this.runtime.settings.reportsDir, 'configs');
                    const configFile = path.join(configsDir, `${configId}.json`);

                    if (!fs.existsSync(configFile)) {
                        res.status(404).json({ error: 'Report not found' });
                        return;
                    }

                    const report = JSON.parse(fs.readFileSync(configFile, 'utf8'));

                    // Generate the report using the unified method (without sending email)
                    const filePath = await this.generatePdfFromTemplate(report, false);

                    const fileName = filePath ? path.basename(filePath) : null;

                    res.json({ fileName, path: filePath });
                } catch (err) {
                    if (err instanceof Error) {
                        res.status(400).json({error: err.stack, message: err.message});
                    } else {
                        res.status(400).json({error:'unexpected_error', message: err});
                    }
                    this.runtime.logger.error('api post advanced-reports generate: ' + err);
                }
            }
        });

        /**
         * POST generate advanced report by ID (for report list play button)
         */
        advancedReportsApp.post('/api/advanced-reports/generate/:id', this.secureFnc, async (req: Request, res: Response) => {
            var groups = this.checkGroupsFnc(req);
            if (res.statusCode === 403) {
                this.runtime.logger.error('api post advanced-reports generate: Token Expired');
            } else if (authJwt.adminGroups.indexOf(groups) === -1 ) {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                this.runtime.logger.error("api post advanced-reports generate: Unauthorized");
            } else {
                try {
                    const reportId = req.params.id;

                    // Load the report configuration from file
                    const configsDir = path.join(this.runtime.settings.reportsDir, 'configs');
                    const configFile = path.join(configsDir, `${reportId}.json`);

                    if (!fs.existsSync(configFile)) {
                        res.status(404).json({error: 'not_found', message: 'Report configuration not found'});
                        return;
                    }

                    const report = JSON.parse(fs.readFileSync(configFile, 'utf8'));
                    
                    // Simply call the same method that trigger tags use
                    await this.generatePdfFromTemplate(report);                    res.json({ success: true, message: 'Report generated successfully' });
                } catch (err) {
                    if (err instanceof Error) {
                        res.status(400).json({error: err.stack, message: err.message});
                    } else {
                        res.status(400).json({error:'unexpected_error', message: err});
                    }
                    this.runtime.logger.error('api post advanced-reports generate: ' + err);
                }
            }
        });

        /**
         * POST preview advanced report
         */
        advancedReportsApp.post('/api/advanced-reports/preview', this.secureFnc, async (req: Request, res: Response) => {
            var groups = this.checkGroupsFnc(req);
            if (res.statusCode === 403) {
                this.runtime.logger.error('api post advanced-reports preview: Token Expired');
            } else {
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
                        text,
                        table,
                        image,
                        qrcode: barcodes.qrcode
                    };

                    const pdf = await generate({
                        template,
                        inputs,
                        plugins
                    });

                    // Return PDF as response
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', 'inline; filename="preview.pdf"');
                    res.send(Buffer.from(pdf));

                } catch (err) {
                    if (err instanceof Error) {
                        res.status(400).json({error: err.stack, message: err.message});
                    } else {
                        res.status(400).json({error:'unexpected_error', message: err});
                    }
                    this.runtime.logger.error('api post advanced-reports preview: ' + err);
                }
            }
        });

        /**
         * POST generate advanced report with custom data (for Node-RED integration)
         */
        advancedReportsApp.post('/api/advanced-reports/generate-with-data/:id', this.secureFnc, async (req: Request, res: Response) => {
            var groups = this.checkGroupsFnc(req);
            if (res.statusCode === 403) {
                this.runtime.logger.error('api post advanced-reports generate-with-data: Token Expired');
            } else {
                try {
                    const reportId = req.params.id;
                    const { reportData, tableData } = req.body;

                    // Load the report configuration
                    const configsDir = path.join(this.runtime.settings.reportsDir, 'configs');
                    const configFile = path.join(configsDir, `${reportId}.json`);

                    if (!fs.existsSync(configFile)) {
                        res.status(404).json({ error: 'Report not found' });
                        return;
                    }

                    const report = JSON.parse(fs.readFileSync(configFile, 'utf8'));

                    // Generate the report with custom data
                    const filePath = await this.generatePdfFromTemplateWithData(report, reportData, tableData);

                    const fileName = filePath ? path.basename(filePath) : null;

                    res.json({ fileName, path: filePath });
                } catch (err) {
                    if (err instanceof Error) {
                        res.status(400).json({error: err.stack, message: err.message});
                    } else {
                        res.status(400).json({error:'unexpected_error', message: err});
                    }
                    this.runtime.logger.error('api post advanced-reports generate-with-data: ' + err);
                }
            }
        });

        /**
         * GET advanced report config by ID
         */
        advancedReportsApp.get('/api/advanced-reports/configs/:id', this.secureFnc, (req: Request, res: Response) => {
            var groups = this.checkGroupsFnc(req);
            if (res.statusCode === 403) {
                this.runtime.logger.error('api get advanced-reports configs: Token Expired');
            } else {
                try {
                    const configId = req.params.id;
                    const configsDir = path.join(this.runtime.settings.reportsDir, 'configs');
                    const configFile = path.join(configsDir, `${configId}.json`);

                    if (!fs.existsSync(configFile)) {
                        res.status(404).json({ error: 'Config not found' });
                        return;
                    }

                    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
                    res.json(config);
                } catch (err) {
                    this.runtime.logger.error('api get advanced-reports configs: ' + err);
                    res.status(500).json({ error: 'Internal server error' });
                }
            }
        });

        /**
         * GET advanced report templates
         */
        advancedReportsApp.get('/api/advanced-reports/templates', this.secureFnc, (req: Request, res: Response) => {
            var groups = this.checkGroupsFnc(req);
            if (res.statusCode === 403) {
                this.runtime.logger.error('api get advanced-reports templates: Token Expired');
            } else {
                try {
                    const templatesDir = path.join(this.runtime.settings.reportsDir, 'templates');

                    if (!fs.existsSync(templatesDir)) {
                        res.json([]);
                        return;
                    }

                    // Scan directory for template subdirectories (exclude files like index.json)
                    const templates = fs.readdirSync(templatesDir, { withFileTypes: true })
                        .filter((dirent: any) => dirent.isDirectory())
                        .map((dirent: any) => ({ name: dirent.name }));

                    res.json(templates);
                } catch (err) {
                    this.runtime.logger.error('api get advanced-reports templates: ' + err);
                    res.status(500).json({ error: 'Internal server error' });
                }
            }
        });

        /**
         * GET advanced report template
         */
        advancedReportsApp.get('/api/advanced-reports/templates/:name/template.json', this.secureFnc, (req: Request, res: Response) => {
            var groups = this.checkGroupsFnc(req);
            if (res.statusCode === 403) {
                this.runtime.logger.error('api get advanced-reports template: Token Expired');
            } else {
                try {
                    const templateName = req.params.name;
                    const templatesDir = path.join(this.runtime.settings.reportsDir, 'templates');
                    const templateFile = path.join(templatesDir, templateName, 'template.json');

                    if (!fs.existsSync(templateFile)) {
                        res.status(404).json({ error: 'Template not found' });
                        return;
                    }

                    const template = JSON.parse(fs.readFileSync(templateFile, 'utf8'));
                    res.json(template);
                } catch (err) {
                    this.runtime.logger.error('api get advanced-reports template: ' + err);
                    res.status(500).json({ error: 'Internal server error' });
                }
            }
        });

        /**
         * GET advanced report template thumbnail
         */
        advancedReportsApp.get('/api/advanced-reports/templates/:name/thumbnail.png', this.secureFnc, (req: Request, res: Response) => {
            var groups = this.checkGroupsFnc(req);
            if (res.statusCode === 403) {
                this.runtime.logger.error('api get advanced-reports template thumbnail: Token Expired');
            } else {
                try {
                    const templateName = req.params.name;
                    const templatesDir = path.join(this.runtime.settings.reportsDir, 'templates');
                    const thumbnailFile = path.join(templatesDir, templateName, 'thumbnail.png');

                    if (!fs.existsSync(thumbnailFile)) {
                        res.status(404).json({ error: 'Thumbnail not found' });
                        return;
                    }

                    res.sendFile(thumbnailFile);
                } catch (err) {
                    this.runtime.logger.error('api get advanced-reports template thumbnail: ' + err);
                    res.status(500).json({ error: 'Internal server error' });
                }
            }
        });

        /**
         * POST save template
         */
        advancedReportsApp.post('/api/advanced-reports/templates', this.secureFnc, (req: Request, res: Response) => {
            var groups = this.checkGroupsFnc(req);
            if (res.statusCode === 403) {
                this.runtime.logger.error('api post advanced-reports templates: Token Expired');
            } else if (authJwt.adminGroups.indexOf(groups) === -1 ) {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                this.runtime.logger.error("api post advanced-reports templates: Unauthorized");
            } else {
                try {
                    const { name, template, thumbnailData } = req.body;
                    const templatesDir = path.join(this.runtime.settings.reportsDir, 'templates');
                    const templateDir = path.join(templatesDir, name);

                    if (!fs.existsSync(templatesDir)) {
                        fs.mkdirSync(templatesDir, { recursive: true });
                    }

                    if (fs.existsSync(templateDir)) {
                        res.status(409).json({ error: 'Template already exists' });
                        return;
                    }

                    fs.mkdirSync(templateDir, { recursive: true });

                    // Save template.json in standard pdfme format
                    const templatePath = path.join(templateDir, 'template.json');
                    fs.writeFileSync(templatePath, JSON.stringify(template, null, 2));

                    // Save thumbnail.png
                    const thumbnailPath = path.join(templateDir, 'thumbnail.png');
                    if (thumbnailData) {
                        const base64Data = thumbnailData.replace(/^data:image\/png;base64,/, '');
                        fs.writeFileSync(thumbnailPath, base64Data, 'base64');
                    } else {
                        // Create a minimal placeholder PNG if no thumbnail provided
                        const minimalPNG = Buffer.from([
                            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
                            0x00, 0x00, 0x00, 0x0D, // IHDR chunk length
                            0x49, 0x48, 0x44, 0x52, // IHDR
                            0x00, 0x00, 0x00, 0x01, // width 1
                            0x00, 0x00, 0x00, 0x01, // height 1
                            0x08, 0x02, 0x00, 0x00, 0x00, // bit depth 8, color type 2, etc.
                            0x90, 0x77, 0x53, 0xDE, // CRC
                            0x00, 0x00, 0x00, 0x0C, // IDAT chunk length
                            0x49, 0x44, 0x41, 0x54, // IDAT
                            0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, // image data
                            0x00, 0x00, 0x00, 0x00, // IEND chunk length
                            0x49, 0x45, 0x4E, 0x44, // IEND
                            0xAE, 0x42, 0x60, 0x82  // CRC
                        ]);
                        fs.writeFileSync(thumbnailPath, minimalPNG);
                    }

                    res.json({ success: true, name });
                } catch (err) {
                    this.runtime.logger.error('api post advanced-reports templates: ' + err);
                    res.status(500).json({ error: 'Internal server error' });
                }
            }
        });

        /**
         * PUT update template
         */
        advancedReportsApp.put('/api/advanced-reports/templates/:name', this.secureFnc, (req: Request, res: Response) => {
            var groups = this.checkGroupsFnc(req);
            if (res.statusCode === 403) {
                this.runtime.logger.error('api put advanced-reports templates: Token Expired');
            } else if (authJwt.adminGroups.indexOf(groups) === -1 ) {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                this.runtime.logger.error("api put advanced-reports templates: Unauthorized");
            } else {
                try {
                    const templateName = req.params.name;
                    const { template, thumbnailData } = req.body;
                    const templatesDir = path.join(this.runtime.settings.reportsDir, 'templates');
                    const templateDir = path.join(templatesDir, templateName);

                    if (!fs.existsSync(templateDir)) {
                        res.status(404).json({ error: 'Template not found' });
                        return;
                    }

                    // Update template.json
                    const templatePath = path.join(templateDir, 'template.json');
                    fs.writeFileSync(templatePath, JSON.stringify(template, null, 2));

                    // Update thumbnail.png if provided
                    if (thumbnailData) {
                        const thumbnailPath = path.join(templateDir, 'thumbnail.png');
                        const base64Data = thumbnailData.replace(/^data:image\/png;base64,/, '');
                        fs.writeFileSync(thumbnailPath, base64Data, 'base64');
                    }

                    res.json({ success: true, name: templateName });
                } catch (err) {
                    this.runtime.logger.error('api put advanced-reports templates: ' + err);
                    res.status(500).json({ error: 'Internal server error' });
                }
            }
        });

        /**
         * DELETE template
         */
        advancedReportsApp.delete('/api/advanced-reports/templates/:name', this.secureFnc, (req: Request, res: Response) => {
            var groups = this.checkGroupsFnc(req);
            if (res.statusCode === 403) {
                this.runtime.logger.error('api delete advanced-reports templates: Token Expired');
            } else if (authJwt.adminGroups.indexOf(groups) === -1 ) {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                this.runtime.logger.error("api delete advanced-reports templates: Unauthorized");
            } else {
                try {
                    const templateName = req.params.name;
                    const templatesDir = path.join(this.runtime.settings.reportsDir, 'templates');
                    const templateDir = path.join(templatesDir, templateName);

                    if (!fs.existsSync(templateDir)) {
                        res.status(404).json({ error: 'Template not found' });
                        return;
                    }

                    // Remove the entire template directory
                    fs.rmSync(templateDir, { recursive: true, force: true });

                    res.json({ success: true });
                } catch (err) {
                    this.runtime.logger.error('api delete advanced-reports templates: ' + err);
                    res.status(500).json({ error: 'Internal server error' });
                }
            }
        });

        /**
         * POST advanced report config
         */
        advancedReportsApp.post('/api/advanced-reports/configs', this.secureFnc, (req: Request, res: Response) => {
            var groups = this.checkGroupsFnc(req);
            if (res.statusCode === 403) {
                this.runtime.logger.error('api post advanced-reports configs: Token Expired');
            } else {
                try {
                    const config = req.body;
                    const configsDir = path.join(this.runtime.settings.reportsDir, 'configs');

                    if (!fs.existsSync(configsDir)) {
                        fs.mkdirSync(configsDir, { recursive: true });
                    }

                    const configFile = path.join(configsDir, `${config.id}.json`);
                    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));

                    // Subscribe to trigger tags after saving config
                    this.subscribeToTriggerTags();

                    // Reschedule report if it has scheduling configured
                    if (config.scheduling && config.scheduling !== 'none') {
                        this.scheduleReport(config);
                    } else {
                        // Cancel existing schedule if scheduling is disabled
                        if (this.scheduledJobs.has(config.id)) {
                            this.scheduledJobs.get(config.id).cancel();
                            this.scheduledJobs.delete(config.id);
                        }
                    }

                    res.json({ success: true });
                } catch (err) {
                    this.runtime.logger.error('api post advanced-reports configs: ' + err);
                    res.status(500).json({ error: 'Internal server error' });
                }
            }
        });

        return advancedReportsApp;
    }

    private async prepareInputs(report: any): Promise<any[]> {
        if (report.pdfmeData) {
            // Use pdfme processing for dynamic data and table configs
            const template = report.pdfmeData.template;
            const tableConfigs = report.tableConfigs || [];
            // @ts-ignore
            const { template: processedTemplate, inputs } = await processDynamicData(template, [{}], tableConfigs, undefined, report.globalTimeRange);
            // Update the report template with processed template
            report.pdfmeData.template = processedTemplate;
            return inputs;
        } else {
            // Legacy report processing
            const inputs: any = {};

            // Populate text fields from tags
            for (const [key, schema] of Object.entries(report.template.schemas[0] || {})) {
                const schemaObj = schema as any;
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
    }

    private getTagValue(tagId: string): any {
        // Get tag value from runtime
        const tag = this.runtime.devices.getTag(tagId);
        return tag ? tag.value : null;
    }

    private async getTableData(tableSource: any): Promise<any[]> {
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
        } else if (tableSource.type === 'raw') {
            // Parse JSON from tag
            const jsonTag = this.getTagValue(tableSource.jsonTag);
            if (jsonTag && typeof jsonTag === 'string') {
                try {
                    return JSON.parse(jsonTag);
                } catch (e) {
                    this.runtime.logger.error('Failed to parse table JSON: ' + e);
                    return [];
                }
            }
        }
        return [];
    }

    private async sendEmail(emails: string[], filePath: string, reportName: string): Promise<void> {
        try {
            // Verify file exists and log size
            if (!fs.existsSync(filePath)) {
                throw new Error(`File does not exist: ${filePath}`);
            }
            const stats = fs.statSync(filePath);

            const subject = `FUXA Advanced Report: ${reportName}`;
            const text = `Please find attached the generated report: ${reportName}`;

            const attachments = [{
                filename: path.basename(filePath),
                path: filePath
            }];

            // Use the runtime notificator manager
            await this.runtime.notificatorMgr.sendMailMessage(null, emails.join(','), subject, text, null, attachments);

        } catch (error) {
            this.runtime.logger.error(`Failed to send email for report ${reportName}: ${error}`);
            throw error;
        }
    }

    private async onTagChanged(tagEvent: any) {
        try {
            // Check if runtime and project are initialized
            if (!this.runtime || !this.runtime.project) {
                return;
            }

            const tagId = tagEvent.id;
            const newValue = tagEvent.value;
            const previousValue = this.triggerTagStates.get(tagId);

            // Store current value for next comparison
            this.triggerTagStates.set(tagId, newValue);

            // Check for rising edge (false/low to true/high)
            const isRisingEdge = this.isRisingEdge(previousValue, newValue);

            // Only trigger on rising edge (false/low to true/high)
            const shouldTrigger = isRisingEdge;

            if (!shouldTrigger) {
                return; // Only process on changes
            }

            // Load traditional reports
            const reportsPath = path.join(this.runtime.settings.appDir, 'reports.json');
            let traditionalReports: any[] = [];
            if (fs.existsSync(reportsPath)) {
                traditionalReports = JSON.parse(fs.readFileSync(reportsPath, 'utf8'));
            }

            // Load advanced reports
            const configsDir = path.join(this.runtime.settings.reportsDir, 'configs');
            let advancedReports: any[] = [];
            if (fs.existsSync(configsDir)) {
                const configFiles = fs.readdirSync(configsDir).filter((file: string) => file.endsWith('.json'));
                for (const file of configFiles) {
                    try {
                        const configPath = path.join(configsDir, file);
                        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                        advancedReports.push(config);
                    } catch (err) {
                        console.error('Error loading config file:', file, err);
                    }
                }
            }

            // Combine all reports
            const allReports = [...traditionalReports, ...advancedReports];

            // Find reports that should be triggered by this tag change
            const triggeredReports = allReports.filter((report: any) => {
                // Check old format (triggerTags array)
                if (report.triggerTags && Array.isArray(report.triggerTags)) {
                    return report.triggerTags.includes(tagId);
                }
                // Check new format (single triggerTag)
                if (report.triggerTag) {
                    return report.triggerTag === tagId;
                }
                return false;
            });

            for (const report of triggeredReports) {
                try {

                    // Use the same logic as the Test Report button - call the pdfme generate-pdf endpoint logic
                    await this.generatePdfFromTemplate(report);

                } catch (error) {
                    this.runtime.logger.error(`Error generating triggered report ${report.name}: ${(error as Error).message}`);
                }
            }

        } catch (error) {
            this.runtime.logger.error(`Error in onTagChanged: ${(error as Error).message}`);
        }
    }

    private async generatePdfFromTemplate(report: any, sendEmail: boolean = true): Promise<string | null> {
        try {

            // Get the template from the report
            const template = report.pdfmeData ? report.pdfmeData.template : report.template;
            if (!template) {
                throw new Error('No template found in report configuration');
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
                    width: 210,   // A4 width in mm
                    height: 297,  // A4 height in mm
                    padding: [0, 0, 0, 0] // No padding for blank PDF
                };
            }

            // Ensure inputs is not empty - pdfme requires at least one input object
            let processedInputs = [{}]; // Start with empty object as minimum requirement

            // Process dynamic data (replace @tag placeholders and handle tableConfigs)
            const tableConfigs = report.tableConfigs || [];

            const result = await processDynamicData(processedTemplate, processedInputs, tableConfigs, this.runtime, report.globalTimeRange);
            processedTemplate = result.template;
            processedInputs = result.inputs;

            // Plugins as object with plugin names as keys
            const plugins = { text, multiVariableText, image, svg, line, table, rectangle, ellipse, dateTime, date, time, select, checkbox, radioGroup, signature, qrcode: barcodes.qrcode, ean13: barcodes.ean13, code128: barcodes.code128 };

            // Use the same save path logic as the /api/pdfme/generate-pdf endpoint
            const defaultDir = path.join(this.runtime.settings.reportsDir, 'generated');
            const settings = report.pdfmeData ? report.pdfmeData.settings : (report.pdfmeSettings || {});
            const savePath = settings.savePath || null;
            const reportsDir = savePath ? (path.isAbsolute(savePath) ? savePath : path.join(this.runtime.settings.reportsDir, savePath)) : defaultDir;

            const pdf = await generate({ 
                template: processedTemplate, 
                inputs: processedInputs, 
                plugins, 
                options: (settings && settings.font) ? { font: settings.font } : {} 
            });

            let filePath: string | null = null;

            // Always save PDF to disk first for email attachment
            // Ensure the directory exists
            if (!fs.existsSync(reportsDir)) {
                fs.mkdirSync(reportsDir, { recursive: true });
            }

            // Generate filename with report name, date in dd/mm/yyyy format, and handle duplicates
            const now = new Date();
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const year = now.getFullYear();
            const dateStr = `${day}-${month}-${year}`;
            const baseName = report.name ? `${report.name}_${dateStr}` : `report_${dateStr}`;

            let fileName = `${baseName}.pdf`;
            let counter = 1;
            filePath = path.join(reportsDir, fileName);

            // Check for existing files and append number if needed
            while (fs.existsSync(filePath)) {
                fileName = `${baseName}_${counter}.pdf`;
                filePath = path.join(reportsDir, fileName);
                counter++;
            }

            fs.writeFileSync(filePath, pdf);

            // Send email if configured and requested
            if (sendEmail) {
                const emailSettings = report.emailSettings || (report.settings && report.settings.emails ? { emails: report.settings.emails } : null);
                if (emailSettings && emailSettings.enabled && emailSettings.emails && emailSettings.emails.length > 0 && filePath) {
                    await this.sendEmail(emailSettings.emails, filePath, report.name);
                }
            }

            // Remove file from disk if saveToDisk is disabled
            if (report.saveToDisk === false) {
                fs.unlinkSync(filePath);
                filePath = null;
            }

            return filePath;

        } catch (error) {
            this.runtime.logger.error(`Error in generatePdfFromTemplate: ${(error as Error).message}`);
            throw error;
        }
    }

    private async generatePdfFromTemplateWithData(report: any, reportData: any = {}, tableData: any = {}): Promise<string | null> {
        try {
            // Get the template from the report
            const template = report.pdfmeData ? report.pdfmeData.template : report.template;
            if (!template) {
                throw new Error('No template found in report configuration');
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
                    width: 210,   // A4 width in mm
                    height: 297,  // A4 height in mm
                    padding: [0, 0, 0, 0] // No padding for blank PDF
                };
            }

            // Start with custom report data as inputs
            let processedInputs = [reportData || {}];

            // Process dynamic data (replace @tag placeholders and handle tableConfigs)
            const tableConfigs = report.tableConfigs || [];

            // Override table data with custom tableData if provided
            if (tableData && Object.keys(tableData).length > 0) {
                for (const tableName of Object.keys(tableData)) {
                    if (Array.isArray(tableData[tableName])) {
                        processedInputs[0][tableName] = tableData[tableName];
                    }
                }
            }

            const result = await processDynamicData(processedTemplate, processedInputs, tableConfigs, this.runtime, report.globalTimeRange);
            processedTemplate = result.template;
            processedInputs = result.inputs;

            // Generate PDF
            const plugins = { text, multiVariableText, image, svg, line, table, rectangle, ellipse, dateTime, date, time, select, checkbox, radioGroup, signature, qrcode: barcodes.qrcode, ean13: barcodes.ean13, code128: barcodes.code128 };

            const pdf = await generate({
                template: processedTemplate,
                inputs: processedInputs,
                plugins
            });

            // Use the same save path logic as the /api/pdfme/generate-pdf endpoint
            const defaultDir = path.join(this.runtime.settings.reportsDir, 'generated');
            const settings = report.pdfmeData ? report.pdfmeData.settings : (report.pdfmeSettings || {});
            const savePath = settings.savePath || null;
            const reportsDir = savePath ? (path.isAbsolute(savePath) ? savePath : path.join(this.runtime.settings.reportsDir, savePath)) : defaultDir;

            // Always save PDF to disk first
            // Ensure the directory exists
            if (!fs.existsSync(reportsDir)) {
                fs.mkdirSync(reportsDir, { recursive: true });
            }

            // Generate filename with report name, date in dd/mm/yyyy format, and handle duplicates
            const now = new Date();
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const year = now.getFullYear();
            const dateStr = `${day}-${month}-${year}`;
            const baseName = report.name ? `${report.name}_${dateStr}` : `report_${dateStr}`;

            let fileName = `${baseName}.pdf`;
            let counter = 1;
            let filePath = path.join(reportsDir, fileName);

            // Check for existing files and append number if needed
            while (fs.existsSync(filePath)) {
                fileName = `${baseName}_${counter}.pdf`;
                filePath = path.join(reportsDir, fileName);
                counter++;
            }

            fs.writeFileSync(filePath, pdf);

            // Send email if configured
            const emailSettings = report.emailSettings || (report.settings && report.settings.emails ? { emails: report.settings.emails } : null);
            if (emailSettings && emailSettings.enabled && emailSettings.emails && emailSettings.emails.length > 0 && filePath) {
                await this.sendEmail(emailSettings.emails, filePath, report.name);
            }

            // Remove file from disk if saveToDisk is disabled
            if (report.saveToDisk === false) {
                fs.unlinkSync(filePath);
                filePath = null;
            }

            return filePath;

        } catch (error) {
            this.runtime.logger.error(`Error in generatePdfFromTemplateWithData: ${(error as Error).message}`);
            throw error;
        }
    }

    private async generateReport(report: any): Promise<Buffer> {
        // Prepare inputs
        const inputs = await this.prepareInputs(report);

        // Generate PDF
        const plugins = {
            text,
            table,
            image,
            qrcode: barcodes.qrcode
        };

        const template = report.pdfmeData ? report.pdfmeData.template : report.template;

        const pdf = await generate({
            template,
            inputs,
            plugins
        });

        return Buffer.from(pdf);
    }

    private isRisingEdge(previousValue: any, newValue: any): boolean {
        // Consider rising edge as transition from falsy to truthy
        // This handles boolean false->true, 0->1, null->true, etc.
        const wasFalsy = !previousValue;
        const isTruthy = !!newValue;

        return wasFalsy && isTruthy;
    }

    public loadScheduledReports() {
        try {
            const configsDir = path.join(this.runtime.settings.reportsDir, 'configs');

            if (fs.existsSync(configsDir)) {
                const configFiles = fs.readdirSync(configsDir).filter((file: string) => file.endsWith('.json'));

                for (const file of configFiles) {
                    try {
                        const configPath = path.join(configsDir, file);
                        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

                        if (config.scheduling && config.scheduling !== 'none') {
                            this.scheduleReport(config);
                        }
                    } catch (err) {
                        this.runtime.logger.error(`Error loading scheduled report config ${file}: ${err}`);
                    }
                }
            } else {
            }
        } catch (err) {
            this.runtime.logger.error(`Error loading scheduled reports: ${err}`);
        }
    }

    private scheduleReport(report: any) {

        // Cancel existing job if it exists
        if (this.scheduledJobs.has(report.id)) {
            this.scheduledJobs.get(report.id).cancel();
        }

        const cronExpression = this.getCronFromSchedule(report.scheduling);
        if (!cronExpression) {
            this.runtime.logger.warn(`Invalid scheduling type for report ${report.id}: ${report.scheduling}`);
            return;
        }

        const job = schedule.scheduleJob(report.id, cronExpression, async () => {
            try {
                await this.generateScheduledReport(report);
            } catch (err) {
                this.runtime.logger.error(`Error executing scheduled report ${report.id}: ${err}`);
            }
        });

        this.scheduledJobs.set(report.id, job);
    }

    private getCronFromSchedule(scheduling: string): string | null {
        const now = new Date();
        switch (scheduling) {
            case 'minute':
                // Every minute
                return `* * * * *`;
            case 'hour':
                // Every hour at minute 0
                return `0 * * * *`;
            case 'day':
                // Daily at 2:00 AM
                return `0 2 * * *`;
            case 'week':
                // Weekly on Monday at 2:00 AM
                return `0 2 * * 1`;
            case 'month':
                // Monthly on the 1st at 2:00 AM
                return `0 2 1 * *`;
            default:
                return null;
        }
    }

    private async generateScheduledReport(report: any) {
        try {
            // Use the same method as trigger tags for consistency
            await this.generatePdfFromTemplate(report);
        } catch (err) {
            this.runtime.logger.error(`Error generating scheduled report ${report.id}: ${err}`);
        }
    }
}