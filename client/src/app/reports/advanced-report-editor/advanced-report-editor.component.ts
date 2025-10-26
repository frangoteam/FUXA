import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { Tag } from '../../_models/device';
import { ProjectService, SaveMode } from '../../_services/project.service';
import { HttpClient } from '@angular/common/http';
import { ReportSettingsDialogComponent, ReportSettingsDialogData } from './report-settings-dialog.component';
import { DeviceTagSelectionComponent, DeviceTagSelectionData } from '../../device/device-tag-selection/device-tag-selection.component';
import { SetupComponent } from '../../editor/setup/setup.component';

export interface AdvancedReportEditorData {
    report?: any;
    editmode: number; // 1 = add, 0 = edit, -1 = delete
}

export interface AdvancedReport {
    id: string;
    name: string;
    type: 'advanced';
    pdfmeSettings: any;
    template?: any;
    tableConfigs?: TableConfig[];
    triggerTag?: string;
    globalTimeRange?: TimeRangeConfig;
    createdAt?: string;
    updatedAt?: string;
}

export interface TableConfig {
    fieldName: string;
    columns: TableColumn[];
    timeRange: TimeRangeConfig;
    useReportTimeRange: boolean;
    isAlarmTable?: boolean;
    templateInitialized?: boolean;
    lastColumnCount?: number;
    widthMap?: { [columnLabel: string]: number }; // Store widths by column label
}

export interface TableColumn {
    tagName: string;
    label: string;
    isTimestamp: boolean;
    timestampFormat?: string;
}

export interface TimeRangeConfig {
    from: string;
    to: string;
}

@Component({
    selector: 'app-advanced-report-editor',
    templateUrl: './advanced-report-editor.component.html',
    styleUrls: ['./advanced-report-editor.component.scss']
})
export class AdvancedReportEditorComponent implements OnInit, OnDestroy {

    report: AdvancedReport;
    editMode: number;
    designerUrl: SafeResourceUrl;
    availableTags: Tag[] = [];

    // Track if we're editing a template vs a report
    isEditingTemplate: boolean = false;
    currentTemplateName: string = '';

    // Track current mode in form-viewer (form or viewer)
    currentMode: 'form' | 'viewer' = 'form';
    
    // Track whether we're in designer or viewer mode
    isInViewerModeFlag: boolean = false;

    private destroy$ = new Subject<void>();

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private projectService: ProjectService,
        private sanitizer: DomSanitizer,
        private http: HttpClient,
        private snackBar: MatSnackBar,
        private translateService: TranslateService,
        private dialog: MatDialog
    ) {
        this.designerUrl = this.sanitizer.bypassSecurityTrustResourceUrl('/api/pdfme-static/?embed=true#/designer');
    }

    ngOnInit() {
        this.route.params.subscribe(params => {
            const reportId = params['id'];
            if (reportId) {
                // Edit existing report
                this.editMode = 0;
                this.loadReport(reportId);
            } else {
                // Create new report
                this.editMode = 1;
                this.report = this.createNewReport();
            }
        });

        this.loadTags();

        // Listen for messages from the designer iframe
        window.addEventListener('message', this.handleDesignerMessage.bind(this));
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
        window.removeEventListener('message', this.handleDesignerMessage.bind(this));
    }

    private createNewReport(): AdvancedReport {
        return {
            id: 'adv_' + Date.now(),
            name: '',
            type: 'advanced',
            pdfmeSettings: {
                language: 'en',
                templateFile: '',
                pageSize: 'A4',
                customWidth: 210,
                customHeight: 297,
                padding: '10,10,10,10',
                basePdfFile: '',
                savePath: '_reports/generated'
            }
        };
    }

    private loadTags() {
        const devices = this.projectService.getDeviceList();
        this.availableTags = [];
        devices.forEach(device => {
            if (device.tags) {
                Object.values(device.tags).forEach((tag: Tag) => {
                    this.availableTags.push(tag);
                });
            }
        });
    }

    private async loadReport(reportId: string) {
        try {
            // Load config from API
            const config = await this.http.get(`/api/advanced-reports/configs/${reportId}`).toPromise() as any;
            
            if (config.pdfmeData) {
                // This is a pdfme report with full data
                this.report = {
                    id: config.id,
                    name: config.name,
                    type: config.type,
                    pdfmeSettings: config.pdfmeData.settings,
                    template: config.pdfmeData.template,
                    tableConfigs: config.tableConfigs,
                    triggerTag: config.triggerTag,
                    globalTimeRange: config.globalTimeRange,
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

                // If template has a data URL basePdf, set the filename in settings
                if (config.pdfmeData.template.basePdf && 
                    typeof config.pdfmeData.template.basePdf === 'string' && 
                    config.pdfmeData.template.basePdf.startsWith('data:')) {
                    this.report.pdfmeSettings.basePdfFile = this.report.pdfmeSettings.basePdfFile || 'Uploaded PDF';
                }

                // Send template to iframe
                setTimeout(() => {
                    const designerFrame = document.querySelector('iframe[src*="/api/pdfme-static"]') as HTMLIFrameElement;
                    if (designerFrame && designerFrame.contentWindow) {
                        designerFrame.contentWindow.postMessage({ type: 'LOAD_TEMPLATE', template: config.pdfmeData.template }, '*');
                        // Only update settings if they don't conflict with template basePdf
                        const settingsToUpdate = { ...config.pdfmeData.settings };
                        if (config.pdfmeData.template.basePdf && settingsToUpdate.basePdf) {
                            // Remove basePdf from settings to avoid overriding template
                            delete settingsToUpdate.basePdf;
                        }
                        if (Object.keys(settingsToUpdate).length > 0) {
                            designerFrame.contentWindow.postMessage({ type: 'UPDATE_SETTINGS', settings: settingsToUpdate }, '*');
                        }
                    }
                }, 1000); // Wait for iframe to load

                // Sync tableConfigs with the loaded template
                this.syncTableConfigsWithTemplate(config.pdfmeData.template);
            } else {
                // Legacy format - try to load template separately
                this.report = {
                    id: config.id,
                    name: config.name,
                    type: config.type,
                    pdfmeSettings: config.pdfmeSettings,
                    tableConfigs: config.tableConfigs
                };

                // Ensure savePath has a default value for existing reports
                if (!this.report.pdfmeSettings.savePath) {
                    this.report.pdfmeSettings.savePath = '_reports/generated';
                }

                // Load template from API
                const templateResponse = await this.http.get(`/api/pdfme/templates/${reportId}`).toPromise() as any;
                const template = templateResponse.template;

                // Set template in report object
                this.report.template = template;

                // Send template to iframe
                setTimeout(() => {
                    const designerFrame = document.querySelector('iframe[src*="/api/pdfme-static"]') as HTMLIFrameElement;
                    if (designerFrame && designerFrame.contentWindow) {
                        designerFrame.contentWindow.postMessage({ type: 'LOAD_TEMPLATE', template }, '*');
                    }
                }, 1000); // Wait for iframe to load
            }
        } catch (error) {
            console.error('Error loading report:', error);
            // Fallback to new report
            this.report = this.createNewReport();
            this.report.id = reportId;
        }
    }

    onSave() {
        if (!this.report.name.trim()) {
            this.snackBar.open('Report name is required', 'OK', { duration: 3000 });
            return;
        }

        // Get template from designer and save
        this.saveReport();

        // Navigate back to reports list
        this.router.navigate(['/reports']);
    }

    onCancel() {
        // Save template from designer before closing
        this.saveDesignerTemplate();

        // Navigate back to reports list
        this.router.navigate(['/reports']);
    }

    async openReportSettingsDialog() {
        // Get the current template from the designer to ensure we have the latest
        const designerFrame = document.querySelector('iframe[src*="/api/pdfme-static"]') as HTMLIFrameElement;
        if (designerFrame && designerFrame.contentWindow) {
            designerFrame.contentWindow.postMessage({ type: 'GET_TEMPLATE' }, '*');

            // Wait for the template response
            const template = await new Promise<any>((resolve) => {
                const handler = (event: MessageEvent) => {
                    if (event.data.type === 'TEMPLATE_DATA') {
                        window.removeEventListener('message', handler);
                        resolve(event.data.template);
                    }
                };
                window.addEventListener('message', handler);

                // Timeout after 2 seconds
                setTimeout(() => {
                    window.removeEventListener('message', handler);
                    resolve(this.report.template); // Fallback to current template
                }, 2000);
            });

            if (template) {
                // Update our report with the latest template
                this.report.template = template;
                // Sync tableConfigs with the latest template
                this.syncTableConfigsWithTemplate(template);
            }
        }

        const dialogRef = this.dialog.open(ReportSettingsDialogComponent, {
            data: {
                reportId: this.report.id,
                currentReport: this.report,
                availableTags: this.availableTags,
                pageSizes: ['A4', 'A3', 'A5', 'B4', 'B5', 'LETTER', 'LEGAL', 'custom'],
                orientations: ['portrait', 'landscape'],
                ranges: ['report.item-daterange-none', 'report.item-daterange-day', 'report.item-daterange-week', 'report.item-daterange-month'],
                onTemplateUpdate: (template: any) => {
                    // Update the report template
                    this.report.template = template;
                    this.sendTemplateToDesigner(template);
                }
            },
            width: '800px',
            maxWidth: '90vw',
            maxHeight: '80vh'
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.report = result;
                // Update pdfme designer with new settings and template
                const designerFrame = document.querySelector('iframe[src*="/api/pdfme-static"]') as HTMLIFrameElement;
                if (designerFrame && designerFrame.contentWindow) {
                    // Update the template's basePdf with the new settings before loading
                    if (this.report.template && this.report.pdfmeSettings) {
                        if (this.report.pdfmeSettings.basePdf) {
                            this.report.template.basePdf = this.report.pdfmeSettings.basePdf;
                        } else if (this.report.pdfmeSettings.pageSize === 'custom') {
                            this.report.template.basePdf = {
                                width: this.report.pdfmeSettings.customWidth || 210,
                                height: this.report.pdfmeSettings.customHeight || 297,
                                padding: this.report.pdfmeSettings.padding ? this.report.pdfmeSettings.padding.split(',').map((p: string) => parseFloat(p.trim())) : [10, 10, 10, 10]
                            };
                        } else {
                            // Set predefined page sizes
                            const pageSizes: { [key: string]: { width: number, height: number } } = {
                                'A4': { width: 210, height: 297 },
                                'A3': { width: 297, height: 420 },
                                'Letter': { width: 215.9, height: 279.4 },
                                'Legal': { width: 215.9, height: 355.6 }
                            };
                            const size = pageSizes[this.report.pdfmeSettings.pageSize];
                            if (size) {
                                this.report.template.basePdf = {
                                    width: size.width,
                                    height: size.height,
                                    padding: this.report.pdfmeSettings.padding ? this.report.pdfmeSettings.padding.split(',').map((p: string) => parseFloat(p.trim())) : [10, 10, 10, 10]
                                };
                            }
                        }
                    }

                    designerFrame.contentWindow.postMessage({
                        type: 'UPDATE_SETTINGS',
                        settings: this.report.pdfmeSettings
                    }, '*');
                    // Also update the template if it has changed
                    if (this.report.template) {
                        designerFrame.contentWindow.postMessage({
                            type: 'LOAD_TEMPLATE',
                            template: this.report.template
                        }, '*');
                    }
                }
                // Save the report with updated settings
                this.saveReport();
            }
        });
    }

    openSettingsDialog() {
        // Open FUXA project settings dialog (like the main header settings button)
        this.projectService.saveProject(SaveMode.Current);
        this.dialog.open(SetupComponent, {
            position: { top: '60px' },
        });
    }

    openTagBrowser() {
        const dialogRef = this.dialog.open(DeviceTagSelectionComponent, {
            data: {
                multiSelect: false,
                selectedTags: [],
                devices: this.projectService.getDevices()
            } as DeviceTagSelectionData,
            width: '1000px',
            maxWidth: '95vw',
            height: '700px',
            maxHeight: '90vh'
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result && result.length > 0) {
                // TODO: Could add tag to clipboard or provide other functionality
            }
        });
    }

    onPreview() {
        const iframe = document.querySelector('iframe');
        if (iframe) {
            iframe.contentWindow?.postMessage({ type: 'GENERATE_PDF' }, '*');
        }
    }

    private handleDesignerMessage(event: MessageEvent) {
        if (event.data.type === 'template-updated') {
            this.report.template = event.data.template;
            this.report.updatedAt = new Date().toISOString();
            // Sync tableConfigs with updated template
            this.syncTableConfigsWithTemplate(event.data.template);
        }
        if (event.data.type === 'PDFME_TEMPLATE_SAVED') {
            this.report.template = event.data.template;
        }
        if (event.data.type === 'TABLE_CONFIG_UPDATED') {
            // Handle table configuration updates from the dialog
            const { fieldName, tableConfig } = event.data;
            const configIndex = this.report.tableConfigs.findIndex(config => config.fieldName === fieldName);
            if (configIndex >= 0) {
                this.report.tableConfigs[configIndex] = tableConfig;
                // Update the template with the new configuration
                this.syncTableConfigsWithTemplate(this.report.template);
            }
        }
        if (event.data.type === 'UPDATE_DESIGNER_TEMPLATE') {
            // Handle template updates from report settings dialog
            this.report.template = event.data.template;
            this.sendTemplateToDesigner(event.data.template);
        }
    }

    private syncTableConfigsWithTemplate(template: any) {
        if (!template?.schemas) {
            return;
        }

        // Initialize tableConfigs if it doesn't exist
        if (!this.report.tableConfigs) {
            this.report.tableConfigs = [];
        }

        // Get current table field names from template
        const templateTableNames = new Set<string>();
        for (const pageSchema of template.schemas) {
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
                // Only update template if alarm table hasn't been initialized yet
                // or if columns have changed
                const shouldUpdateTemplate = !config.templateInitialized ||
                    this.hasAlarmTableColumnsChanged(config);

                if (shouldUpdateTemplate) {
                    // Update the template schema for alarm tables
                    for (const pageSchema of template.schemas) {
                        if (pageSchema) {
                            for (const field of pageSchema) {
                                if (field.name === config.fieldName && field.type === 'table') {
                                    // Store current headWidthPercentages before updating
                                    const currentWidths = field.headWidthPercentages ? [...field.headWidthPercentages] : null;

                                    // Set the head to match alarm column labels
                                    field.head = config.columns.map(col => col.label);

                                    // Calculate column widths - preserve existing widths when possible
                                    const totalColumns = config.columns.length;
                                    if (currentWidths && currentWidths.length === totalColumns) {
                                        // Same number of columns - preserve existing widths
                                        field.headWidthPercentages = [...currentWidths];
                                    } else {
                                        // Different number of columns - recalculate equal distribution
                                        const equalWidth = Math.floor(100 / totalColumns);
                                        const remainder = 100 % totalColumns;
                                        field.headWidthPercentages = config.columns.map((_, index) =>
                                            index < remainder ? equalWidth + 1 : equalWidth
                                        );
                                    }

                                    // Set content to empty string - actual data populated during PDF generation
                                    field.content = "";

                                    break;
                                }
                            }
                        }
                    }

                    // Mark as initialized and update column count
                    config.templateInitialized = true;
                    config.lastColumnCount = config.columns.length;

                    // Send real-time update to PDFME designer
                    this.sendTemplateToDesigner(template);
                }
            }
        }
    }

    private saveDesignerTemplate() {
        // Send message to designer to save current template
        const designerFrame = document.querySelector('iframe[src*="/api/pdfme-static"]') as HTMLIFrameElement;
        if (designerFrame && designerFrame.contentWindow) {
            designerFrame.contentWindow.postMessage({ type: 'SAVE_TEMPLATE' }, '*');
        }
    }

    async saveReport() {
        if (this.isEditingTemplate && this.currentTemplateName) {
            // We're editing a template, save it
            await this.saveCurrentTemplate();
            return;
        }

        // Normal report saving logic
        // Check if report has a name
        if (!this.report.name || !this.report.name.trim()) {
            this.snackBar.open('Please enter a report name first', 'OK', { duration: 3000 });
            this.openReportSettingsDialog();
            return;
        }

        try {
            // Get the current template from the designer
            const designerFrame = document.querySelector('iframe[src*="/api/pdfme-static"]') as HTMLIFrameElement;
            if (designerFrame && designerFrame.contentWindow) {
                designerFrame.contentWindow.postMessage({ type: 'GET_TEMPLATE' }, '*');

                // Wait for the template response
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

                if (template) {
                    // Sync tableConfigs with the current template before saving
                    this.syncTableConfigsWithTemplate(template);

                    // Use the report name as the filename (sanitized for filesystem)
                    const filename = this.report.name.replace(/[^a-zA-Z0-9]/g, '_');
                    const isNewReport = !this.report.id || !this.report.id.trim();

                    // Save the complete report data including full pdfme template
                    const reportData = {
                        id: filename,
                        name: this.report.name,
                        type: this.report.type,
                        pdfmeData: {
                            template: template,
                            settings: this.report.pdfmeSettings
                        },
                        tableConfigs: this.report.tableConfigs,
                        triggerTag: this.report.triggerTag,
                        globalTimeRange: this.report.globalTimeRange,
                        scheduling: (this.report as any).scheduling,
                        emailSettings: (this.report as any).emailSettings,
                        saveToDisk: (this.report as any).saveToDisk,
                        createdAt: isNewReport ? new Date().toISOString() : this.report.createdAt || new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };

                    // Save to configs API
                    await this.http.post('/api/advanced-reports/configs', reportData).toPromise();

                    this.snackBar.open('Report saved successfully', 'OK', { duration: 3000 });

                    // Update the report ID and timestamps
                    this.report.id = filename;
                    this.report.createdAt = reportData.createdAt;
                    this.report.updatedAt = reportData.updatedAt;
                } else {
                    this.snackBar.open('Failed to get template from designer. Please try again.', 'OK', { duration: 5000 });
                    return;
                }
            }
        } catch (error) {
            console.error('Error saving report:', error);
            this.snackBar.open('Error saving report', 'OK', { duration: 3000 });
        }
    }

    switchToViewer() {
        // Set the viewer mode flag
        this.isInViewerModeFlag = true;
        
        // First get the current template from the designer
        const iframe = document.querySelector('iframe');
        if (iframe) {
            // Listen for the template data response
            const handleTemplateData = (event: MessageEvent) => {
                if (event.data.type === 'TEMPLATE_DATA') {
                    window.removeEventListener('message', handleTemplateData);
                    // Navigate first
                    iframe.contentWindow?.postMessage({ 
                        type: 'navigate', 
                        payload: { 
                            mode: 'form-viewer',
                            reportId: this.report.id
                        } 
                    }, '*');
                    // Then send the template to the new component
                    setTimeout(() => {
                        iframe.contentWindow?.postMessage({ 
                            type: 'LOAD_TEMPLATE', 
                            template: event.data.template 
                        }, '*');
                    }, 500); // Wait for navigation to complete
                }
            };
            window.addEventListener('message', handleTemplateData);
            // Request the template
            iframe.contentWindow?.postMessage({ type: 'GET_TEMPLATE' }, '*');
        }
    }

    switchToDesigner() {
        // Set the designer mode flag
        this.isInViewerModeFlag = false;
        
        // First get the current template from the viewer
        const iframe = document.querySelector('iframe');
        if (iframe) {
            // Listen for the template data response
            const handleTemplateData = (event: MessageEvent) => {
                if (event.data.type === 'TEMPLATE_DATA') {
                    window.removeEventListener('message', handleTemplateData);
                    // Navigate first
                    iframe.contentWindow?.postMessage({ 
                        type: 'navigate', 
                        payload: { 
                            mode: 'designer',
                            reportId: this.report.id
                        } 
                    }, '*');
                    // Then send the template to the new component
                    setTimeout(() => {
                        iframe.contentWindow?.postMessage({ 
                            type: 'LOAD_TEMPLATE', 
                            template: event.data.template 
                        }, '*');
                    }, 500); // Wait for navigation to complete
                }
            };
            window.addEventListener('message', handleTemplateData);
            // Request the template
            iframe.contentWindow?.postMessage({ type: 'GET_TEMPLATE' }, '*');
        }
    }

    changeMode(newMode: 'form' | 'viewer') {
        this.currentMode = newMode;
        const iframe = document.querySelector('iframe');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ 
                type: 'CHANGE_MODE', 
                mode: newMode 
            }, '*');
        }
    }

    isInViewerMode(): boolean {
        return this.isInViewerModeFlag;
    }

    onModeChange(event: any) {
        this.changeMode(event.value);
    }

    private async saveCurrentTemplate() {
        try {
            // Get the current template from the designer
            const designerFrame = document.querySelector('iframe[src*="/api/pdfme-static"]') as HTMLIFrameElement;
            if (designerFrame && designerFrame.contentWindow) {
                designerFrame.contentWindow.postMessage({ type: 'SAVE_TEMPLATE' }, '*');

                // Wait for the template response
                const templateData = await new Promise<any>((resolve) => {
                    const handler = (event: MessageEvent) => {
                        if (event.data.type === 'TEMPLATE_SAVED') {
                            window.removeEventListener('message', handler);
                            resolve(event.data);
                        }
                    };
                    window.addEventListener('message', handler);

                    // Timeout after 10 seconds
                    setTimeout(() => {
                        window.removeEventListener('message', handler);
                        resolve(null);
                    }, 10000);
                });

                if (templateData) {
                    // Update the existing template
                    await this.http.put(`/api/advanced-reports/templates/${this.currentTemplateName}`, {
                        template: templateData.template,
                        thumbnailData: templateData.thumbnail
                    }).toPromise();

                    this.snackBar.open('Template updated successfully!', 'OK', { duration: 3000 });
                } else {
                    this.snackBar.open('Failed to get template data', 'OK', { duration: 3000 });
                }
            }
        } catch (error) {
            console.error('Error saving template:', error);
            this.snackBar.open('Error saving template', 'OK', { duration: 3000 });
        }
    }

    private hasAlarmTableColumnsChanged(config: TableConfig): boolean {
        return config.lastColumnCount !== config.columns.length;
    }

    private sendTemplateToDesigner(template: any) {
        // Send the updated template to the PDFME designer
        const designerFrame = document.querySelector('iframe[src*="/api/pdfme-static"]') as HTMLIFrameElement;
        if (designerFrame && designerFrame.contentWindow) {
            designerFrame.contentWindow.postMessage({
                type: 'UPDATE_TEMPLATE',
                template: template
            }, '*');
        } else {
            console.log('Designer frame not found');
        }
    }
}
