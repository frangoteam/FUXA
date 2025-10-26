import { Component, Inject } from '@angular/core';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { HttpClient } from '@angular/common/http';

export interface TemplateInfo {
    name: string;
    thumbnailUrl?: string;
    templateUrl?: string;
}

export interface TemplateManagerDialogData {
    mode: 'select' | 'manage' | 'save'; // 'select' for loading template, 'manage' for template management, 'save' for saving template
    defaultTemplateName?: string;
}

@Component({
    selector: 'app-template-manager-dialog',
    templateUrl: './template-manager-dialog.component.html',
    styleUrls: ['./template-manager-dialog.component.css']
})
export class TemplateManagerDialogComponent {

    templates: TemplateInfo[] = [];
    selectedTemplate: TemplateInfo | null = null;
    loading = true;

    // Save template form state
    showSaveForm = false;
    saveTemplateName = '';
    overwriteExisting = false;

    // Delete confirmation state
    showDeleteConfirm = false;
    templateToDelete: TemplateInfo | null = null;

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: TemplateManagerDialogData,
        private dialogRef: MatDialogRef<TemplateManagerDialogComponent>,
        private http: HttpClient,
        private snackBar: MatSnackBar,
        private dialog: MatDialog
    ) {
        this.selectedTemplate = null; // Ensure no template is selected initially
        this.loadTemplates();

        // If mode is 'save', show the save form immediately
        if (data.mode === 'save') {
            this.showSaveForm = true;
            this.saveTemplateName = data.defaultTemplateName || '';
        }
    }

    async loadTemplates() {
        try {
            // Load template index
            const indexResponse = await this.http.get<any[]>('/api/advanced-reports/templates').toPromise();
            
            this.templates = await Promise.all(
                indexResponse.map(async (template) => {
                    const templateInfo: TemplateInfo = {
                        name: template.name,
                        templateUrl: `/api/advanced-reports/templates/${template.name}/template.json`,
                        thumbnailUrl: `/api/advanced-reports/templates/${template.name}/thumbnail.png`
                    };
                    
                    // Check if thumbnail exists, if not we'll generate one
                    try {
                        await this.http.head(templateInfo.thumbnailUrl).toPromise();
                    } catch {
                        // Thumbnail doesn't exist, we'll generate it when needed
                        templateInfo.thumbnailUrl = undefined;
                    }
                    
                    return templateInfo;
                })
            );
        } catch (error) {
            console.error('Error loading templates:', error);
            this.snackBar.open('Error loading templates', 'OK', { duration: 3000 });
        } finally {
            this.loading = false;
        }
    }

    selectTemplate(template: TemplateInfo) {
        if (this.selectedTemplate === template) {
            // Clicking on already selected template deselects it
            this.selectedTemplate = null;
        } else {
            this.selectedTemplate = template;
        }
    }

    async confirmSelection() {
        if (this.selectedTemplate) {
            try {
                // Load the template data
                const templateData = await this.http.get(this.selectedTemplate.templateUrl).toPromise();
                this.dialogRef.close(templateData);
            } catch (error) {
                console.error('Error loading template:', error);
                this.snackBar.open('Error loading selected template', 'OK', { duration: 3000 });
            }
        }
    }

    editTemplate(template: TemplateInfo) {
        // For edit mode, we need to open the template in the main editor
        // This will require navigating to the designer with the template loaded
        this.http.get(template.templateUrl).subscribe({
            next: (templateData) => {
                // Close this dialog and emit the template data to be loaded in the main editor
                this.dialogRef.close({ action: 'edit', template: templateData, templateName: template.name });
            },
            error: (error) => {
                console.error('Error loading template for editing:', error);
                this.snackBar.open('Error loading template for editing', 'OK', { duration: 3000 });
            }
        });
    }

    deleteTemplate(template: TemplateInfo) {
        this.templateToDelete = template;
        this.showDeleteConfirm = true;
    }

    confirmDelete() {
        if (this.templateToDelete) {
            this.http.delete(`/api/advanced-reports/templates/${this.templateToDelete.name}`).subscribe({
                next: () => {
                    this.snackBar.open('Template deleted successfully', 'OK', { duration: 3000 });
                    this.loadTemplates(); // Refresh the template list
                    this.cancelDelete();
                },
                error: (error) => {
                    console.error('Error deleting template:', error);
                    this.snackBar.open('Error deleting template', 'OK', { duration: 3000 });
                    this.cancelDelete();
                }
            });
        }
    }

    cancelDelete() {
        this.showDeleteConfirm = false;
        this.templateToDelete = null;
    }

    cancelSaveTemplate() {
        this.showSaveForm = false;
        this.saveTemplateName = '';
        this.overwriteExisting = false;
        this.dialogRef.close(null);
    }

    async saveTemplate() {
        if (!this.saveTemplateName.trim()) {
            this.snackBar.open('Please enter a template name', 'OK', { duration: 3000 });
            return;
        }

        try {
            // Get the current template from the pdfme editor
            const designerFrame = document.querySelector('iframe[src*="/api/pdfme-static"]') as HTMLIFrameElement;
            if (!designerFrame || !designerFrame.contentWindow) {
                this.snackBar.open('Unable to access template designer', 'OK', { duration: 3000 });
                return;
            }

            designerFrame.contentWindow.postMessage({ type: 'SAVE_TEMPLATE' }, '*');

            // Wait for the template response
            const templateData = await new Promise<any>((resolve, reject) => {
                const handleTemplateData = (event: MessageEvent) => {
                    if (event.data.type === 'TEMPLATE_SAVED') {
                        window.removeEventListener('message', handleTemplateData);
                        resolve(event.data);
                    }
                };
                window.addEventListener('message', handleTemplateData);

                // Timeout after 10 seconds
                setTimeout(() => {
                    window.removeEventListener('message', handleTemplateData);
                    reject(new Error('Timeout waiting for template data'));
                }, 10000);
            });

            if (templateData && templateData.template) {
                // Check if template already exists
                const existingTemplate = this.templates.find(t => t.name === this.saveTemplateName.trim());
                if (existingTemplate && !this.overwriteExisting) {
                    this.snackBar.open('Template already exists. Check "Overwrite existing" to replace it.', 'OK', { duration: 5000 });
                    return;
                }

                await this.http.post('/api/advanced-reports/templates', {
                    name: this.saveTemplateName.trim(),
                    template: templateData.template,
                    thumbnailData: templateData.thumbnail
                }).toPromise();

                this.snackBar.open('Template saved successfully!', 'OK', { duration: 3000 });
                this.loadTemplates(); // Refresh the template list
                this.dialogRef.close({ action: 'template_saved', templateName: this.saveTemplateName.trim() });
            } else {
                this.snackBar.open('Failed to get template data', 'OK', { duration: 3000 });
            }
        } catch (error) {
            console.error('Error saving template:', error);
            this.snackBar.open('Error saving template', 'OK', { duration: 3000 });
        }
    }

    onFileSelected(event: any) {
        const file = event.target.files[0];
        if (file && file.name.endsWith('.json')) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const templateData = JSON.parse(e.target?.result as string);
                    const templateName = file.name.replace('.json', '');
                    
                    // Generate thumbnail by loading template into designer and saving it
                    let thumbnailData: string | undefined;
                    try {
                        const designerFrame = document.querySelector('iframe[src*="/api/pdfme-static"]') as HTMLIFrameElement;
                        if (designerFrame && designerFrame.contentWindow) {
                            // Load the template into the designer
                            designerFrame.contentWindow.postMessage({ 
                                type: 'LOAD_TEMPLATE', 
                                template: templateData 
                            }, '*');

                            // Wait for the template to be loaded in the designer
                            await new Promise<void>((resolve, reject) => {
                                const handleTemplateLoaded = (event: MessageEvent) => {
                                    if (event.data.type === 'TEMPLATE_LOADED') {
                                        window.removeEventListener('message', handleTemplateLoaded);
                                        resolve();
                                    }
                                };
                                window.addEventListener('message', handleTemplateLoaded);

                                // Timeout after 10 seconds
                                setTimeout(() => {
                                    window.removeEventListener('message', handleTemplateLoaded);
                                    reject(new Error('Timeout waiting for template to load'));
                                }, 10000);
                            });

                            // Now generate thumbnail using the same method as save
                            designerFrame.contentWindow.postMessage({ type: 'SAVE_TEMPLATE' }, '*');

                            // Wait for the template response with thumbnail
                            const savedData = await new Promise<any>((resolve, reject) => {
                                const handleSaveData = (event: MessageEvent) => {
                                    if (event.data.type === 'TEMPLATE_SAVED') {
                                        window.removeEventListener('message', handleSaveData);
                                        resolve(event.data);
                                    }
                                };
                                window.addEventListener('message', handleSaveData);

                                // Timeout after 15 seconds
                                setTimeout(() => {
                                    window.removeEventListener('message', handleSaveData);
                                    reject(new Error('Timeout waiting for thumbnail generation'));
                                }, 15000);
                            });

                            thumbnailData = savedData.thumbnail;
                        } else {
                            console.warn('Designer iframe not found for thumbnail generation');
                        }
                    } catch (thumbnailError) {
                        console.warn('Failed to generate thumbnail for uploaded template:', thumbnailError);
                        // Continue with upload even if thumbnail generation fails
                    }
                    
                    // Upload the template
                    this.http.post('/api/advanced-reports/templates', {
                        name: templateName,
                        template: templateData,
                        thumbnailData: thumbnailData
                    }).subscribe({
                        next: () => {
                            this.snackBar.open('Template uploaded successfully', 'OK', { duration: 3000 });
                            this.loadTemplates(); // Refresh the template list
                        },
                        error: (error: any) => {
                            console.error('Error uploading template:', error);
                            this.snackBar.open(error.error?.message || 'Error uploading template', 'OK', { duration: 3000 });
                        }
                    });
                } catch (error) {
                    this.snackBar.open('Invalid JSON file', 'OK', { duration: 3000 });
                }
            };
            reader.readAsText(file);
        } else {
            this.snackBar.open('Please select a valid JSON file', 'OK', { duration: 3000 });
        }
        // Reset the input
        event.target.value = '';
    }

    downloadTemplate() {
        if (!this.selectedTemplate) return;

        this.http.get(this.selectedTemplate.templateUrl, { responseType: 'blob' }).subscribe({
            next: (blob) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${this.selectedTemplate!.name}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            },
            error: (error) => {
                console.error('Error downloading template:', error);
                this.snackBar.open('Error downloading template', 'OK', { duration: 3000 });
            }
        });
    }

    onCancel() {
        this.dialogRef.close();
    }
}