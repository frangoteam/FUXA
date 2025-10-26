import { Component, Inject } from '@angular/core';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { HttpClient } from '@angular/common/http';
import { Tag } from '../../_models/device';
import { AdvancedReport, TableConfig, TableColumn } from './advanced-report-editor.component';
import { TableConfigDialogComponent } from './table-config-dialog.component';
import { TemplateManagerDialogComponent } from './template-manager-dialog.component';
import { FileExplorerDialogComponent } from '../../file-explorer/file-explorer-dialog.component';
import { FlexDeviceTagComponent, FlexDeviceTagValueType } from '../../gauges/gauge-property/flex-device-tag/flex-device-tag.component';

export interface TableField {
    name: string;
    type: string;
}

export interface TimeRangeConfig {
    from: string;
    to: string;
}

export interface ReportSettingsDialogData {
    reportId: string;
    currentReport: AdvancedReport;
    availableTags: Tag[];
    pageSizes: string[];
    orientations: string[];
    ranges: string[];
    onTemplateUpdate?: (template: any) => void; // Callback for real-time template updates
}

@Component({
    selector: 'app-report-settings-dialog',
    templateUrl: './report-settings-dialog.component.html',
    styleUrls: ['./report-settings-dialog.component.css']
})
export class ReportSettingsDialogComponent {

    report: AdvancedReport;
    availableTags: Tag[];

    pdfmeSettings: any = {};

    // Template editing state
    isEditingTemplate: boolean = false;
    currentTemplateName: string = '';

    // Table configuration
    tableFields: TableField[] = [];
    schedulingOptions = [
        { value: 'none', label: 'No Scheduling' },
        { value: 'minute', label: 'Every Minute' },
        { value: 'hour', label: 'Hourly' },
        { value: 'day', label: 'Daily' },
        { value: 'week', label: 'Weekly' },
        { value: 'month', label: 'Monthly (1st of month)' }
    ];
    selectedScheduling = 'none';

    // Email settings
    emailSettings = {
        enabled: false,
        subject: 'FUXA Advanced Report',
        message: 'Please find attached the generated report.',
        emails: ['']
    };

    // Global time range for tables
    globalTimeRange: TimeRangeConfig = {
        from: 'now-24h',
        to: 'now'
    };

    saveToDisk = true;

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: any,
        private dialogRef: MatDialogRef<ReportSettingsDialogComponent>,
        private dialog: MatDialog,
        private snackBar: MatSnackBar,
        private http: HttpClient
    ) {
        this.availableTags = data.availableTags;

        // Initialize report with current data to prevent template errors
        this.report = data.currentReport || {
            id: data.reportId,
            name: '',
            type: 'advanced',
            pdfmeSettings: {},
            tableConfigs: []
        };

        // Load the latest report data from server, but use current template
        this.loadReport(data.reportId, data.currentReport);
    }

    ngOnInit() {
        // Listen for messages from table config dialog
        window.addEventListener('message', (event) => {
            if (event.data.type === 'TABLE_CONFIG_UPDATED') {
                this.handleTableConfigUpdate(event.data.payload);
            }
        });
    }

    private async loadReport(reportId: string, currentReport: AdvancedReport) {
        try {
            const config = await this.http.get(`/api/advanced-reports/configs/${reportId}`).toPromise() as any;
            
            this.report = {
                id: config.id,
                name: config.name,
                type: config.type,
                pdfmeSettings: config.pdfmeData.settings,
                template: currentReport.template || config.pdfmeData.template, // Use current template if available
                tableConfigs: currentReport.tableConfigs || config.tableConfigs, // Use current tableConfigs if available
                triggerTag: config.triggerTag,
                createdAt: config.createdAt,
                updatedAt: config.updatedAt
            };

            // Clean up old settings that might have basePdf
            if (this.report.pdfmeSettings.basePdf) {
                delete this.report.pdfmeSettings.basePdf;
            }

            // Ensure savePath has a default value for existing reports
            if (!this.report.pdfmeSettings.savePath) {
                this.report.pdfmeSettings.savePath = '_reports/generated';
            }

            // Initialize pdfme settings from report
            const defaultSettings = {
                language: 'en',
                templateFile: '',
                pageSize: 'A4',
                customWidth: 210,
                customHeight: 297,
                padding: '10,10,10,10',
                basePdfFile: '',
                savePath: '_reports/generated'
            };

            this.pdfmeSettings = { ...defaultSettings, ...(this.report.pdfmeSettings || {}) };

            // Sync page size with basePdf from template (what PDFME actually uses)
            this.syncPageSizeFromTemplateBasePdf();

            // Detect table fields in the template
            this.detectTableFields();
            
            // Sync table configs with current template
            this.syncTableConfigsWithTemplate();

            // Load scheduling and email settings
            this.selectedScheduling = config.scheduling || 'none';
            this.emailSettings = { ...this.emailSettings, ...(config.emailSettings || {}) };
            this.saveToDisk = config.saveToDisk !== false;
            this.globalTimeRange = config.globalTimeRange || this.globalTimeRange;
        } catch (error) {
            console.error('Failed to load report:', error);
            this.snackBar.open('Failed to load report configuration', 'OK', { duration: 3000 });
        }
    }

    onPageSizeChange() {
        this.updateBasePdf();
        this.updateDesignerBasePdf();
    }

    onPaddingChange() {
        this.updateBasePdf();
        this.updateDesignerBasePdf();
    }

    onCustomSizeChange() {
        this.updateBasePdf();
        this.updateDesignerBasePdf();
    }

    onTriggerTagChange(tagValue: FlexDeviceTagValueType) {
        this.report.triggerTag = tagValue?.variableId || null;
    }

    parsePadding(paddingStr: string): number[] | null {
        if (!paddingStr) return null;
        const parts = paddingStr.split(',').map(p => parseFloat(p.trim()));
        if (parts.length === 1) {
            return [parts[0], parts[0], parts[0], parts[0]];
        } else if (parts.length === 4) {
            return parts;
        }
        return null;
    }

    selectBasePdf() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/pdf';
        input.onchange = (event: any) => {
            const file = event.target.files[0];
            if (file) {
                if (file.type !== 'application/pdf') {
                    this.snackBar.open('Please select a valid PDF file', 'OK', { duration: 3000 });
                    return;
                }
                
                // Read the file as data URL 
                const reader = new FileReader();
                reader.onload = (e) => {
                    const dataUrl = e.target?.result as string;
                    if (dataUrl) {
                        // Store the filename in settings for display
                        this.pdfmeSettings.basePdfFile = file.name;
                        
                        // Update the template directly with the basePdf data URL
                        this.updateTemplateBasePdf(dataUrl);
                        
                        this.snackBar.open(`Base PDF "${file.name}" selected`, 'OK', { duration: 2000 });
                    }
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    }

    clearBasePdf() {
        this.pdfmeSettings.basePdfFile = '';
        // Clear the basePdf from the template
        this.updateTemplateBasePdf('');
        this.snackBar.open('Base PDF removed', 'OK', { duration: 2000 });
    }

    selectSavePath() {
        const dialogRef = this.dialog.open(FileExplorerDialogComponent, {
            disableClose: false,
            autoFocus: false,
            restoreFocus: false,
            panelClass: 'file-explorer-dialog-panel',
            width: '900px',
            height: '750px',
            maxWidth: '900px',
            maxHeight: '750px',
            minWidth: '900px',
            minHeight: '750px',
            hasBackdrop: true,
            data: {
                title: 'Select Save Directory',
                initialPath: this.pdfmeSettings.savePath || '_reports/generated',
                selectDirectories: true,
                selectFiles: false
            }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result && result.type === 'directory') {
                // Convert absolute path to relative path if it's within the server directory
                let savePath = result.path;
                const serverPathPattern = /\/server\/(.+)$/;
                const match = result.path.match(serverPathPattern);
                if (match) {
                    savePath = match[1];
                }
                
                this.pdfmeSettings.savePath = savePath;
                this.snackBar.open(`Save path set to: ${savePath}`, 'OK', { duration: 2000 });
            }
        });
    }

    updateBasePdf() {
        const padding = this.parsePadding(this.pdfmeSettings.padding) || [10, 10, 10, 10];
        
        // Only update basePdf in settings if it's not a data URL (uploaded PDF)
        // For uploaded PDFs, basePdf is handled in the template directly
        if (this.pdfmeSettings.pageSize === 'custom') {
            this.pdfmeSettings.basePdf = {
                width: this.pdfmeSettings.customWidth || 210,
                height: this.pdfmeSettings.customHeight || 297,
                padding: padding
            };
        } else {
            // Set predefined page sizes
            const pageSizes: { [key: string]: { width: number, height: number } } = {
                'A4': { width: 210, height: 297 },
                'A3': { width: 297, height: 420 },
                'Letter': { width: 215.9, height: 279.4 }, // 8.5x11 inches in mm
                'Legal': { width: 215.9, height: 355.6 } // 8.5x14 inches in mm
            };
            const size = pageSizes[this.pdfmeSettings.pageSize];
            if (size) {
                this.pdfmeSettings.basePdf = {
                    width: size.width,
                    height: size.height,
                    padding: padding
                };
            }
        }
    }

    updateDesignerBasePdf() {
        // Update the PDFME designer's template basePdf in real-time when settings change
        const designerFrame = document.querySelector('iframe[src*="/api/pdfme-static"]') as HTMLIFrameElement;
        if (designerFrame && designerFrame.contentWindow && this.pdfmeSettings.basePdf) {
            designerFrame.contentWindow.postMessage({
                type: 'UPDATE_TEMPLATE_BASEPDF',
                basePdf: this.pdfmeSettings.basePdf
            }, '*');
        }
    }

    syncPageSizeFromTemplateBasePdf() {
        // Sync settings from the template's basePdf (what PDFME actually uses)
        if (this.report.template && this.report.template.basePdf && typeof this.report.template.basePdf === 'object') {
            const basePdf = this.report.template.basePdf;
            this.pdfmeSettings.customWidth = basePdf.width;
            this.pdfmeSettings.customHeight = basePdf.height;
            this.pdfmeSettings.padding = basePdf.padding ? basePdf.padding.join(',') : '10,10,10,10';

            // Try to match to predefined page sizes
            const pageSizes: { [key: string]: { width: number, height: number } } = {
                'A4': { width: 210, height: 297 },
                'A3': { width: 297, height: 420 },
                'Letter': { width: 215.9, height: 279.4 },
                'Legal': { width: 215.9, height: 355.6 }
            };

            let matchedSize = 'custom';
            for (const [size, dims] of Object.entries(pageSizes)) {
                if (Math.abs(basePdf.width - dims.width) < 1 && Math.abs(basePdf.height - dims.height) < 1) {
                    matchedSize = size;
                    break;
                }
            }

            this.pdfmeSettings.pageSize = matchedSize;
            
            // Also update the settings basePdf to match
            this.pdfmeSettings.basePdf = basePdf;
        } else {
            // Fallback to sync from settings basePdf
            this.syncPageSizeFromBasePdf();
        }
    }

    syncPageSizeFromBasePdf() {
        // This method is only used for blank PDF configurations
        if (this.pdfmeSettings.basePdf && typeof this.pdfmeSettings.basePdf === 'object') {
            const basePdf = this.pdfmeSettings.basePdf;
            this.pdfmeSettings.customWidth = basePdf.width;
            this.pdfmeSettings.customHeight = basePdf.height;
            this.pdfmeSettings.padding = basePdf.padding ? basePdf.padding.join(',') : '10,10,10,10';

            // Try to match to predefined page sizes
            const pageSizes: { [key: string]: { width: number, height: number } } = {
                'A4': { width: 210, height: 297 },
                'A3': { width: 297, height: 420 },
                'Letter': { width: 215.9, height: 279.4 },
                'Legal': { width: 215.9, height: 355.6 }
            };

            let matchedSize = 'custom';
            for (const [size, dims] of Object.entries(pageSizes)) {
                if (Math.abs(basePdf.width - dims.width) < 1 && Math.abs(basePdf.height - dims.height) < 1) {
                    matchedSize = size;
                    break;
                }
            }
            this.pdfmeSettings.pageSize = matchedSize;
        }
    }

    loadTemplate() {
        const dialogRef = this.dialog.open(TemplateManagerDialogComponent, {
            data: { mode: 'select' },
            width: '800px',
            maxWidth: '90vw',
            maxHeight: '80vh'
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                // Template selected, load it into the pdfme editor
                this.pdfmeSettings.templateFile = 'Loaded from template';
                
                // Update the report template
                this.report.template = result;
                
                // Send the template to the pdfme iframe
                const designerFrame = document.querySelector('iframe[src*="/api/pdfme-static"]') as HTMLIFrameElement;
                if (designerFrame && designerFrame.contentWindow) {
                    designerFrame.contentWindow.postMessage({ 
                        type: 'LOAD_TEMPLATE', 
                        template: result 
                    }, '*');
                }
                
                this.snackBar.open('Template loaded successfully!', 'OK', { duration: 3000 });
            }
        });
    }

    saveAsTemplate() {
        // Get the current template from the pdfme editor
        const designerFrame = document.querySelector('iframe[src*="/api/pdfme-static"]') as HTMLIFrameElement;
        if (designerFrame && designerFrame.contentWindow) {
            designerFrame.contentWindow.postMessage({ type: 'SAVE_TEMPLATE' }, '*');

            // Wait for the template response
            const handleTemplateData = (event: MessageEvent) => {
                if (event.data.type === 'TEMPLATE_SAVED') {
                    window.removeEventListener('message', handleTemplateData);

                    // Open template manager dialog in save mode
                    const dialogRef = this.dialog.open(TemplateManagerDialogComponent, {
                        data: {
                            mode: 'save'
                        },
                        width: '800px',
                        maxWidth: '90vw'
                    });

                    dialogRef.afterClosed().subscribe(result => {
                        if (result && result.action === 'template_saved') {
                            this.snackBar.open(`Template "${result.templateName}" saved successfully!`, 'OK', { duration: 3000 });
                        }
                    });
                } else if (event.data.type === 'TEMPLATE_SAVE_ERROR') {
                    window.removeEventListener('message', handleTemplateData);
                    this.snackBar.open('Error generating template preview', 'OK', { duration: 3000 });
                }
            };
            window.addEventListener('message', handleTemplateData);

            // Timeout after 10 seconds
            setTimeout(() => {
                window.removeEventListener('message', handleTemplateData);
                this.snackBar.open('Template save timed out', 'OK', { duration: 3000 });
            }, 10000);
        } else {
            this.snackBar.open('PDFme editor not found', 'OK', { duration: 3000 });
        }
    }

    openTemplateManager() {
        const dialogRef = this.dialog.open(TemplateManagerDialogComponent, {
            data: { mode: 'manage' },
            width: '800px',
            maxWidth: '90vw',
            maxHeight: '80vh'
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result && result.action === 'edit' && result.template) {
                // Load the template into the pdfme editor
                const designerFrame = document.querySelector('iframe[src*="/api/pdfme-static"]') as HTMLIFrameElement;
                if (designerFrame && designerFrame.contentWindow) {
                    designerFrame.contentWindow.postMessage({
                        type: 'LOAD_TEMPLATE',
                        template: result.template
                    }, '*');
                    this.snackBar.open('Template loaded for editing', 'OK', { duration: 3000 });

                    // Set template editing state
                    this.isEditingTemplate = true;
                    this.currentTemplateName = result.templateName || '';

                    // Close this dialog and indicate that a template was loaded for editing
                    this.dialogRef.close({ action: 'template_loaded', templateName: result.templateName });
                }
            }
        });
    }

    generatePdf() {
        this.generatePdfOnServer(false);
    }

    generateTestReport() {
        this.generatePdfOnServer(true);
    }

    private async generatePdfOnServer(isTest: boolean = false) {
        try {
            // Get the current template from the designer iframe
            const designerFrame = document.querySelector('iframe[src*="/api/pdfme-static"]') as HTMLIFrameElement;
            if (!designerFrame || !designerFrame.contentWindow) {
                this.snackBar.open('Designer not available', 'OK', { duration: 3000 });
                return;
            }

            // Request template data
            designerFrame.contentWindow.postMessage({ type: 'GET_TEMPLATE' }, '*');

            // Wait for template response
            const template = await new Promise<any>((resolve) => {
                const handler = (event: MessageEvent) => {
                    if (event.data.type === 'TEMPLATE_DATA') {
                        window.removeEventListener('message', handler);
                        resolve(event.data.template);
                    }
                };
                window.addEventListener('message', handler);

                // Timeout after 5 seconds
                setTimeout(() => {
                    window.removeEventListener('message', handler);
                    resolve(null);
                }, 5000);
            });

            if (!template) {
                this.snackBar.open('Failed to get template from designer', 'OK', { duration: 3000 });
                return;
            }

            // Get current inputs from designer 
            let inputs = [];
            try {
                designerFrame.contentWindow.postMessage({ type: 'GET_INPUTS' }, '*');

                inputs = await new Promise<any[]>((resolve) => {
                    const handler = (event: MessageEvent) => {
                        if (event.data.type === 'INPUTS_DATA') {
                            window.removeEventListener('message', handler);
                            resolve(event.data.inputs || []);
                        }
                    };
                    window.addEventListener('message', handler);

                    // Timeout after 2 seconds - inputs are optional
                    setTimeout(() => {
                        window.removeEventListener('message', handler);
                        resolve([]);
                    }, 2000);
                });
            } catch (error) {
                // Inputs not supported, use empty array
                inputs = [];
            }

            // Prepare the request data
            let requestData: any;
            let endpoint: string;

            if (isTest) {
                // For test reports, use the test-generate endpoint to simulate trigger tag behavior
                // Ensure the report has the current settings
                const reportWithSettings = {
                    ...this.report,
                    saveToDisk: this.saveToDisk,
                    emailSettings: this.emailSettings
                };
                requestData = {
                    ...reportWithSettings, // Include all report settings (saveToDisk, emailSettings, etc.)
                    template: template,
                    inputs: inputs || [],
                    pdfmeSettings: {
                        ...this.pdfmeSettings,
                        font: this.pdfmeSettings.font || undefined
                    }
                };
                endpoint = '/api/advanced-reports/test-generate';
            } else {
                // For regular PDF generation, use the pdfme endpoint
                requestData = {
                    template: template,
                    inputs: inputs || [],
                    options: {
                        font: this.pdfmeSettings.font || undefined
                    },
                    savePath: this.pdfmeSettings.savePath || '_reports/generated',
                    reportName: this.report.name || 'report',
                    isDynamicReport: false,
                    tableConfigs: this.report.tableConfigs || []
                };
                endpoint = '/api/pdfme/generate-pdf';
            }

            // Call server-side PDF generation
            const response = await this.http.post(endpoint, requestData).toPromise() as any;

            if (response.success || (isTest && response.fileName)) {
                const action = isTest ? 'Test report' : 'PDF';
                const message = isTest 
                    ? (response.message || 'Test report generated successfully')
                    : `PDF generated successfully: ${response.fileName}`;
                this.snackBar.open(message, 'OK', { duration: 5000 });
            } else {
                this.snackBar.open('PDF generation failed', 'OK', { duration: 3000 });
            }

        } catch (error) {
            console.error('Error generating PDF:', error);
            this.snackBar.open('Error generating PDF', 'OK', { duration: 3000 });
        }
    }

    updateTemplateBasePdf(dataUrl: string) {
        // Send message to iframe to update template basePdf directly
        const designerFrame = document.querySelector('iframe[src*="/api/pdfme-static"]') as HTMLIFrameElement;
        if (designerFrame && designerFrame.contentWindow) {
            designerFrame.contentWindow.postMessage({ 
                type: 'UPDATE_TEMPLATE_BASEPDF', 
                basePdf: dataUrl 
            }, '*');
        }
    }

    async onSave() {
        if (this.isEditingTemplate && this.currentTemplateName) {
            // We're editing a template, save it
            this.saveCurrentTemplate();
        } else {
            // Normal report settings save
            if (!this.report.name.trim()) {
                this.snackBar.open('Report name is required', 'OK', { duration: 3000 });
                return;
            }

            // Get the current template from the PDFme designer before saving
            const designerFrame = document.querySelector('iframe[src*="/api/pdfme-static"]') as HTMLIFrameElement;
            if (designerFrame && designerFrame.contentWindow) {
                designerFrame.contentWindow.postMessage({ type: 'GET_TEMPLATE' }, '*');

                // Wait for the template response
                const currentTemplate = await new Promise<any>((resolve) => {
                    const handler = (event: MessageEvent) => {
                        if (event.data.type === 'TEMPLATE_DATA') {
                            window.removeEventListener('message', handler);
                            resolve(event.data.template);
                        }
                    };
                    window.addEventListener('message', handler);

                    // Timeout after 3 seconds
                    setTimeout(() => {
                        window.removeEventListener('message', handler);
                        resolve(this.report.template); // Fallback to existing template
                    }, 3000);
                });

                // Update the report with the current template
                if (currentTemplate) {
                    this.report.template = currentTemplate;
                }
            }

            this.report.pdfmeSettings = this.pdfmeSettings;
            
            // Ensure basePdf is up to date in settings
            this.updateBasePdf();
            
            // Update the template's basePdf to match the settings
            if (this.report.template) {
                this.report.template.basePdf = this.pdfmeSettings.basePdf;
            }
            
            // Sync table configs with current template
            this.syncTableConfigsWithTemplate();

            // Notify parent to update designer with the new template that has sample data
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                    type: 'UPDATE_DESIGNER_TEMPLATE',
                    template: this.report.template
                }, '*');
            }

            // Add scheduling and email settings
            (this.report as any).scheduling = this.selectedScheduling;
            (this.report as any).emailSettings = this.emailSettings;
            (this.report as any).saveToDisk = this.saveToDisk;
            (this.report as any).globalTimeRange = this.globalTimeRange;
            
            this.dialogRef.close(this.report);
        }
    }

    private saveCurrentTemplate() {
        // Get the current template from the pdfme editor
        const designerFrame = document.querySelector('iframe[src*="/api/pdfme-static"]') as HTMLIFrameElement;
        if (designerFrame && designerFrame.contentWindow) {
            designerFrame.contentWindow.postMessage({ type: 'SAVE_TEMPLATE' }, '*');

            // Wait for the template response
            const handleTemplateData = (event: MessageEvent) => {
                if (event.data.type === 'TEMPLATE_SAVED') {
                    window.removeEventListener('message', handleTemplateData);

                    // Save/update the template
                    this.http.put(`/api/advanced-reports/templates/${this.currentTemplateName}`, {
                        template: event.data.template,
                        thumbnailData: event.data.thumbnail
                    }).subscribe({
                        next: () => {
                            this.snackBar.open('Template updated successfully!', 'OK', { duration: 3000 });
                            this.dialogRef.close({ action: 'template_saved', templateName: this.currentTemplateName });
                        },
                        error: (error: any) => {
                            console.error('Error updating template:', error);
                            this.snackBar.open(error.error?.message || 'Error updating template', 'OK', { duration: 3000 });
                        }
                    });
                } else if (event.data.type === 'TEMPLATE_SAVE_ERROR') {
                    window.removeEventListener('message', handleTemplateData);
                    this.snackBar.open('Error generating template preview', 'OK', { duration: 3000 });
                }
            };
            window.addEventListener('message', handleTemplateData);

            // Timeout after 10 seconds
            setTimeout(() => {
                window.removeEventListener('message', handleTemplateData);
                this.snackBar.open('Template save timed out', 'OK', { duration: 3000 });
            }, 10000);
        } else {
            this.snackBar.open('PDFme editor not found', 'OK', { duration: 3000 });
        }
    }

    onCancel() {
        this.dialogRef.close();
    }

    // Table configuration methods
    private detectTableFields() {
        const newTableFields: TableField[] = [];
        const tableNames = new Set<string>();

        // First, add tables from existing configs (in case template is not updated yet)
        if (this.report.tableConfigs) {
            this.report.tableConfigs.forEach(config => {
                tableNames.add(config.fieldName);
                newTableFields.push({
                    name: config.fieldName,
                    type: 'table'
                });
            });
        }

        // Then add tables from template
        if (this.report.template?.schemas) {
            // Check all pages for table fields
            for (const pageSchema of this.report.template.schemas) {
                if (pageSchema) {
                    for (const field of pageSchema) {
                        if (field.type === 'table' && !tableNames.has(field.name)) {
                            tableNames.add(field.name);
                            newTableFields.push({
                                name: field.name,
                                type: 'table'
                            });
                        }
                    }
                }
            }
        }

        // Update the array reference to trigger change detection
        this.tableFields = newTableFields;
    }

    getTableConfig(fieldName: string): TableConfig | undefined {
        return this.report.tableConfigs?.find(config => config.fieldName === fieldName);
    }

    private syncTableConfigsWithTemplate(template?: any) {
        const targetTemplate = template || this.report.template;
        if (!targetTemplate?.schemas) {
            return;
        }

        // Initialize tableConfigs if it doesn't exist
        if (!this.report.tableConfigs) {
            this.report.tableConfigs = [];
        }

        // Get current table field names from template
        const templateTableNames = new Set<string>();
        for (const pageSchema of targetTemplate.schemas) {
            if (pageSchema) {
                for (const field of pageSchema) {
                    if (field.type === 'table') {
                        templateTableNames.add(field.name);
                    }
                }
            }
        }

        // Track which template tables already have configs
        const usedTemplateNames = new Set<string>();

        // Update existing configs to match template names
        this.report.tableConfigs.forEach(config => {
            if (templateTableNames.has(config.fieldName)) {
                // Config matches existing table
                usedTemplateNames.add(config.fieldName);
            } else {
                // Config doesn't match any table, assign to an unused table
                for (const templateName of templateTableNames) {
                    if (!usedTemplateNames.has(templateName)) {
                        config.fieldName = templateName;
                        usedTemplateNames.add(templateName);
                        break;
                    }
                }
            }
        });

        // Create new configs for tables that don't have configs yet
        for (const templateName of templateTableNames) {
            if (!usedTemplateNames.has(templateName)) {
                // Create a new table config for this table
                const newConfig: TableConfig = {
                    fieldName: templateName,
                    columns: [],
                    timeRange: {
                        from: 'now - 1 hour',
                        to: 'now'
                    },
                    useReportTimeRange: false
                };
                this.report.tableConfigs.push(newConfig);
                usedTemplateNames.add(templateName);
            }
        }

        // Remove configs for tables that no longer exist
        this.report.tableConfigs = this.report.tableConfigs.filter(config => 
            templateTableNames.has(config.fieldName)
        );

        // Update table schemas in template for alarm tables
        for (const config of this.report.tableConfigs) {
            if (config.isAlarmTable) {
                // Update the template schema for alarm tables
                for (const pageSchema of targetTemplate.schemas) {
                    if (pageSchema) {
                        for (const field of pageSchema) {
                            if (field.name === config.fieldName && field.type === 'table') {
                                // Store current widths in the config's widthMap before updating
                                if (!config.widthMap) {
                                    config.widthMap = {};
                                }
                                if (field.head && field.headWidthPercentages) {
                                    field.head.forEach((colName: string, index: number) => {
                                        if (field.headWidthPercentages && field.headWidthPercentages[index] !== undefined) {
                                            config.widthMap![colName] = field.headWidthPercentages[index];
                                        }
                                    });
                                }

                                // Set the head to match alarm column labels
                                field.head = config.columns.map(col => col.label);

                                // Calculate column widths using the widthMap
                                field.headWidthPercentages = config.columns.map(col => {
                                    // Try to get width from widthMap
                                    if (config.widthMap && config.widthMap[col.label] !== undefined) {
                                        return config.widthMap[col.label];
                                    }
                                    // Default width for new columns
                                    return Math.floor(100 / config.columns.length);
                                });

                                // Normalize widths to ensure they sum to 100
                                const totalWidth = field.headWidthPercentages.reduce((sum, w) => sum + w, 0);
                                if (totalWidth !== 100) {
                                    const adjustment = (100 - totalWidth) / field.headWidthPercentages.length;
                                    field.headWidthPercentages = field.headWidthPercentages.map(w => Math.round(w + adjustment));
                                }

                                // Generate sample alarm data for the designer preview
                                field.content = this.generateSampleAlarmData(config.columns);

                                break;
                            }
                        }
                    }
                }
            }
        }

        // Update table fields detection
        this.detectTableFields();
    }

    private generateSampleAlarmData(columns: TableColumn[]): string {
        // Generate sample alarm data for preview in the designer
        const sampleData: any[][] = [];

        // Create 3 sample alarm records
        for (let i = 1; i <= 3; i++) {
            const row: any[] = [];

            for (const column of columns) {
                switch (column.label) {
                    case 'Tag Name':
                        row.push(`Sample Tag ${i}`);
                        break;
                    case 'Type':
                        row.push(i % 2 === 0 ? 'Digital' : 'Analog');
                        break;
                    case 'Status':
                        const statuses = ['Active', 'Inactive', 'High Alarm', 'Low Alarm', 'Fault'];
                        row.push(statuses[(i - 1) % statuses.length]);
                        break;
                    case 'Message':
                        const messages = [
                            'Tag is active',
                            'Value above threshold',
                            'Value below threshold',
                            'Communication fault',
                            'Sensor error'
                        ];
                        row.push(messages[(i - 1) % messages.length]);
                        break;
                    case 'Group':
                        row.push(`Group ${String.fromCharCode(65 + ((i - 1) % 3))}`); // Group A, B, C
                        break;
                    case 'On Time':
                        row.push(`2024-01-01 10:${String(i * 5).padStart(2, '0')}:00`);
                        break;
                    case 'Off Time':
                        row.push(`2024-01-01 09:${String(i * 5).padStart(2, '0')}:00`);
                        break;
                    case 'Ack Time':
                        row.push(`2024-01-01 10:${String(30 + i * 5).padStart(2, '0')}:00`);
                        break;
                    case 'User Ack':
                        row.push(i % 2 === 0 ? 'operator1' : 'operator2');
                        break;
                    default:
                        row.push(`Sample ${column.label}`);
                        break;
                }
            }

            sampleData.push(row);
        }

        return JSON.stringify(sampleData);
    }

    handleTableConfigUpdate(updatedConfig: TableConfig) {
        // Initialize tableConfigs array if it doesn't exist
        if (!this.report.tableConfigs) {
            this.report.tableConfigs = [];
        }

        // Update or add the configuration
        const existingIndex = this.report.tableConfigs.findIndex(config => config.fieldName === updatedConfig.fieldName);
        if (existingIndex >= 0) {
            this.report.tableConfigs[existingIndex] = updatedConfig;
        } else {
            this.report.tableConfigs.push(updatedConfig);
        }

        // Sync template schema with updated table configs
        this.syncTableConfigsWithTemplate();

        // Notify parent component to update PDFME designer immediately
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                type: 'UPDATE_DESIGNER_TEMPLATE',
                template: this.report.template
            }, '*');
        }
    }

    configureTable(tableField: TableField) {
        const currentConfig = this.getTableConfig(tableField.name);

        const dialogRef = this.dialog.open(TableConfigDialogComponent, {
            width: '900px',
            height: '80vh',
            data: {
                tableField,
                currentConfig,
                availableTags: this.availableTags,
                reportTimeRange: 'report.item-daterange-none', // TODO: Get from report settings
                report: this.report,
                onConfigChange: (updatedConfig: TableConfig) => {
                    // Update the report's table config
                    if (!this.report.tableConfigs) {
                        this.report.tableConfigs = [];
                    }
                    const existingIndex = this.report.tableConfigs.findIndex(config => config.fieldName === updatedConfig.fieldName);
                    if (existingIndex >= 0) {
                        this.report.tableConfigs[existingIndex] = updatedConfig;
                    } else {
                        this.report.tableConfigs.push(updatedConfig);
                    }

                    // Sync template schema with updated table configs
                    this.syncTableConfigsWithTemplate();

                    // Notify parent component to update PDFME designer immediately
                    if (this.data.onTemplateUpdate) {
                        this.data.onTemplateUpdate(this.report.template);
                    } else if (window.parent && window.parent !== window) {
                        window.parent.postMessage({
                            type: 'UPDATE_DESIGNER_TEMPLATE',
                            template: this.report.template
                        }, '*');
                    }
                }
            }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                // Initialize tableConfigs array if it doesn't exist
                if (!this.report.tableConfigs) {
                    this.report.tableConfigs = [];
                }

                // Update or add the configuration
                const existingIndex = this.report.tableConfigs.findIndex(config => config.fieldName === tableField.name);
                if (existingIndex >= 0) {
                    this.report.tableConfigs[existingIndex] = result;
                } else {
                    this.report.tableConfigs.push(result);
                }

                this.snackBar.open('Table configuration saved', 'OK', { duration: 3000 });

                // Sync template schema with updated table configs
                this.syncTableConfigsWithTemplate();

                // Notify parent component to update PDFME designer immediately
                if (window.parent && window.parent !== window) {
                    window.parent.postMessage({
                        type: 'UPDATE_DESIGNER_TEMPLATE',
                        template: this.report.template
                    }, '*');
                }
            }
        });
    }

    addEmail() {
        this.emailSettings.emails.push('');
    }

    removeEmail(index: number) {
        if (this.emailSettings.emails.length > 1) {
            this.emailSettings.emails.splice(index, 1);
        }
    }

    trackByIndex(index: number, item: any): number {
        return index;
    }

    resetSavePath() {
        this.pdfmeSettings.savePath = '_reports/generated';
        this.snackBar.open('Save path reset to default', 'OK', { duration: 2000 });
    }
}