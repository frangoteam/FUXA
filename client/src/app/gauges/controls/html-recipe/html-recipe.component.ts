import { Component, Input, ViewContainerRef, ComponentFactoryResolver, ComponentRef, OnInit, OnDestroy } from '@angular/core';
import { MatDialog as MatDialog } from '@angular/material/dialog';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component';
import { GaugeSettings } from '../../../_models/hmi';
import { Utils } from '../../../_helpers/utils';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';
import { RecipeService } from '../../../_services/recipe.service';
import { HmiService } from '../../../_services/hmi.service';
import { AuthService } from '../../../_services/auth.service';
import { TranslateService } from '@ngx-translate/core';
import { Recipe, RecipeEntry, RecipeProgressEvent, RecipeCompleteEvent } from '../../../_models/recipe';
import { Subscription } from 'rxjs';
import { HtmlRecipeNewDialogComponent } from './html-recipe-new-dialog/html-recipe-new-dialog.component';

/**
 * Runtime view component for the HTML recipe widget.
 * Displays instances of a single recipe type with prev/next navigation,
 * editable entries table, and action buttons for save / download / upload.
 */
@Component({
    selector: 'html-recipe-view',
    templateUrl: './html-recipe.component.html',
    styleUrls: ['./html-recipe.component.css']
})
export class HtmlRecipeViewComponent implements OnInit, OnDestroy {

    /** Editor mode — permission checks are bypassed (factory sets from isview) */
    @Input() isEditor: boolean = false;

    /** The designer property object (permission, visibleActions, colours...) */
    @Input() property: any = null;

    /** The recipe type id this widget is bound to */
    typeId: string = '';

    /** The recipe type definition (for creating new instances) */
    typeDefinition: Recipe | null = null;

    /** All instances of the bound recipe type */
    instances: { id: string; data: Recipe }[] = [];

    /** Current position in the instances array */
    currentIndex: number = -1;

    /** Id of the currently displayed instance */
    currentInstanceId: string = '';

    /** Currently displayed instance data */
    currentInstance: Recipe | null = null;

    /** Editable copy of the current instance's entries */
    entries: RecipeEntry[] = [];

    loading = false;
    error: string = '';
    saving = false;
    deleting = false;
    downloading = false;
    uploading = false;
    readonly = false;

    /** Result of the action-bar permission check (FR-30) */
    permission: { show: boolean; enabled: boolean } = { show: true, enabled: true };

    /** Gauge colour properties bound from the designer */
    backgroundColor: string = '#f0f0f0';
    textColor: string = '#505050';
    borderColor: string = '#cccccc';
    accentColor: string = '#2196f3';
    borderWidth: number = 1;

    /** Progress state during download / upload execution */
    progress: { current: number; total: number; errors: string[] } | null = null;

    /** Tracks the current execution direction for progress filtering */
    private progressMode: 'download' | 'upload' | null = null;

    private subscriptionDownloadProgress!: Subscription;
    private subscriptionDownloadComplete!: Subscription;
    private subscriptionDownloadError!: Subscription;
    private subscriptionUploadProgress!: Subscription;
    private subscriptionUploadComplete!: Subscription;
    private subscriptionUploadError!: Subscription;
    private subscriptionCanceled!: Subscription;

    constructor(private recipeService: RecipeService, private hmiService: HmiService, private dialog: MatDialog,
        private authService: AuthService, private translateService: TranslateService) { }

    ngOnInit() {
        this.permission = this._checkPermission();
        if (this.typeId) {
            this.loadTypeDefinition();
            this.loadInstances();
        } else {
            this.loading = false;
        }
        this._subscribeToProgressEvents();
    }

    ngOnDestroy() {
        this._unsubscribeProgress();
    }

    /** Load the recipe type template (for creating new instances) */
    loadTypeDefinition() {
        if (!this.typeId) return;
        this.recipeService.getRecipe(this.typeId).subscribe({
            next: (type) => {
                this.typeDefinition = type;
            },
            error: () => {
                // Non-critical — instances still work without type template
            }
        });
    }

    /** Load all instances of the bound recipe type */
    loadInstances() {
        if (!this.typeId) {
            this.loading = false;
            return;
        }

        this.loading = true;
        this.error = '';
        this.recipeService.getRecipeInstances(this.typeId).subscribe({
            next: (result) => {
                this.instances = result.recipes || [];
                this.loading = false;

                // Restore selection if the current instance still exists
                if (this.currentInstanceId && this.instances.some(r => r.id === this.currentInstanceId)) {
                    this._selectInstance(this.currentInstanceId);
                } else if (this.instances.length > 0) {
                    this._selectInstance(this.instances[0].id);
                } else {
                    this._clearSelection();
                }
            },
            error: () => {
                this.error = 'Failed to load instances';
                this.loading = false;
            }
        });
    }

    /** Select and display an instance by id */
    private _selectInstance(id: string) {
        const idx = this.instances.findIndex(r => r.id === id);
        if (idx < 0) return;

        this.currentIndex = idx;
        this.currentInstanceId = id;
        this.currentInstance = { ...this.instances[idx].data };
        this.entries = (this.currentInstance.entries || []).map(e => ({ ...e }));
        this.error = '';
    }

    /** Clear the current selection */
    private _clearSelection() {
        this.currentInstance = null;
        this.currentInstanceId = '';
        this.currentIndex = -1;
        this.entries = [];
    }

    /** Navigate to the previous instance */
    onPrev() {
        if (this.currentIndex > 0) {
            this._selectInstance(this.instances[this.currentIndex - 1].id);
        }
    }

    /** Navigate to the next instance */
    onNext() {
        if (this.currentIndex < this.instances.length - 1) {
            this._selectInstance(this.instances[this.currentIndex + 1].id);
        }
    }

    /** Subscribe to download and upload Socket.IO progress events */
    private _subscribeToProgressEvents() {
        this.subscriptionDownloadProgress = this.hmiService.onRecipeDownloadProgress
            .subscribe((event: RecipeProgressEvent) => {
                if (this.progressMode !== 'download') return;
                this.progress = { current: event.index + 1, total: event.total, errors: [] };
            });

        this.subscriptionDownloadComplete = this.hmiService.onRecipeDownloadComplete
            .subscribe((event: RecipeCompleteEvent) => {
                if (this.progressMode !== 'download') return;
                this.downloading = false;
                this.progressMode = null;
                this.progress = null;
                if (event.errorCount > 0) {
                    this.error = `Download completed with ${event.errorCount} error(s)`;
                }
            });

        this.subscriptionDownloadError = this.hmiService.onRecipeDownloadError
            .subscribe((event: any) => {
                if (this.progressMode !== 'download') return;
                this.downloading = false;
                this.progressMode = null;
                this.progress = null;
                this.error = event.error || 'Download failed';
            });

        this.subscriptionUploadProgress = this.hmiService.onRecipeUploadProgress
            .subscribe((event: RecipeProgressEvent) => {
                if (this.progressMode !== 'upload') return;
                this.progress = { current: event.index + 1, total: event.total, errors: [] };
            });

        this.subscriptionUploadComplete = this.hmiService.onRecipeUploadComplete
            .subscribe((event: RecipeCompleteEvent) => {
                if (this.progressMode !== 'upload') return;
                this.uploading = false;
                this.progressMode = null;
                this.progress = null;
                if (event.errorCount > 0) {
                    this.error = `Upload completed with ${event.errorCount} error(s)`;
                }
                setTimeout(() => this.loadInstances(), 1000);
            });

        this.subscriptionUploadError = this.hmiService.onRecipeUploadError
            .subscribe((event: any) => {
                if (this.progressMode !== 'upload') return;
                this.uploading = false;
                this.progressMode = null;
                this.progress = null;
                this.error = event.error || 'Upload failed';
            });

        this.subscriptionCanceled = this.hmiService.onRecipeCanceled
            .subscribe((event: any) => {
                if (event.recipeId !== this.currentInstanceId) return;
                this.downloading = false;
                this.uploading = false;
                this.progressMode = null;
                this.progress = null;
            });
    }

    /** Tear down all progress subscriptions */
    private _unsubscribeProgress() {
        this._safeUnsubscribe(this.subscriptionDownloadProgress);
        this._safeUnsubscribe(this.subscriptionDownloadComplete);
        this._safeUnsubscribe(this.subscriptionDownloadError);
        this._safeUnsubscribe(this.subscriptionUploadProgress);
        this._safeUnsubscribe(this.subscriptionUploadComplete);
        this._safeUnsubscribe(this.subscriptionUploadError);
        this._safeUnsubscribe(this.subscriptionCanceled);
    }

    /** Safely unsubscribe from an RxJS subscription */
    private _safeUnsubscribe(sub: Subscription | undefined): void {
        try {
            if (sub) {
                sub.unsubscribe();
            }
        } catch (_e) {
            // Ignore unsubscribe errors during teardown
        }
    }

    /** Sanitize entries: coerce null/undefined/empty-string to defaults per tagType */
    private _sanitizeEntries(entries: RecipeEntry[]): RecipeEntry[] {
        return entries.map(e => {
            if (e.value === null || e.value === undefined || e.value === '') {
                const t = (e.tagType || '').toLowerCase();
                if (['bool', 'boolean'].includes(t)) {
                    e.value = false;
                } else if (['int', 'dint', 'int16', 'int32', 'number', 'real', 'float', 'double', 'byte'].includes(t)) {
                    e.value = 0;
                } else {
                    e.value = '';
                }
            }
            return e;
        });
    }

    /**
     * Evaluate the action-bar permission: editor mode always passes,
     * otherwise delegate to the standard FUXA permission check (FR-30).
     */
    private _checkPermission(): { show: boolean; enabled: boolean } {
        if (this.isEditor) {
            return { show: true, enabled: true };
        }
        return this.authService.checkPermission(this.property) || { show: true, enabled: true };
    }

    /**
     * Whether a given action button should render.
     * Driven by property.visibleActions, independent of permission (FR-31).
     */
    isActionVisible(action: 'new' | 'delete' | 'save' | 'download' | 'upload'): boolean {
        return this.property?.visibleActions?.[action] ?? true;
    }

    /** Save the current instance entries to the server */
    onSave() {
        if (!this.currentInstanceId || !this.currentInstance) return;

        this.saving = true;
        this.error = '';
        this._sanitizeEntries(this.entries);

        const recipe = {
            id: this.currentInstanceId,
            typeId: this.typeId,
            name: this.currentInstance.name,
            description: this.currentInstance.description,
            entries: this.entries
        };

        this.recipeService.saveRecipe(recipe).subscribe({
            next: () => {
                this.saving = false;
                this.loadInstances();
            },
            error: (err) => {
                this.error = err?.error?.error || 'Save failed';
                this.saving = false;
            }
        });
    }

    /**
     * Delete the current instance after a native confirm dialog.
     * Reloads the instance list on success, surfaces errors on failure (FR-26).
     */
    onDelete() {
        if (this.deleting || !this.currentInstanceId || !this.currentInstance) return;

        const name = this.currentInstance.name || this.currentInstanceId;
        if (!confirm(this.translateService.instant('recipe.delete-confirm', { name }))) {
            return;
        }

        this.deleting = true;
        this.error = '';
        this.recipeService.deleteRecipe(this.currentInstanceId).subscribe({
            next: () => {
                this.deleting = false;
                this.loadInstances();
            },
            error: (err) => {
                this.deleting = false;
                this.error = err?.error?.error || 'Delete failed';
            }
        });
    }

    /**
     * Download (push) the current instance values to the PLC.
     * Saves edited values first, then triggers the async download.
     */
    onDownload() {
        if (this.downloading || this.saving || !this.currentInstanceId || !this.currentInstance) return;

        this.error = '';
        this._sanitizeEntries(this.entries);

        const recipe = {
            id: this.currentInstanceId,
            typeId: this.typeId,
            name: this.currentInstance.name,
            description: this.currentInstance.description,
            entries: this.entries
        };

        this.saving = true;
        this.recipeService.saveRecipe(recipe).subscribe({
            next: () => {
                this.saving = false;
                this.recipeService.downloadRecipe(this.currentInstanceId).subscribe({
                    next: (result) => {
                        this.progressMode = 'download';
                        this.downloading = true;
                        this.progress = { current: 0, total: result.totalEntries || this.entries.length, errors: [] };
                    },
                    error: (err) => {
                        this.downloading = false;
                        this.progress = null;
                        this.error = err?.error?.error || 'Download failed';
                    }
                });
            },
            error: (err) => {
                this.error = err?.error?.error || 'Save before download failed';
                this.saving = false;
            }
        });
    }

    /**
     * Upload (pull) current PLC values into the current instance and refresh
     * the displayed entries afterwards.
     */
    onUpload() {
        if (this.uploading || !this.currentInstanceId) return;

        this.error = '';
        this.recipeService.uploadRecipe(this.currentInstanceId).subscribe({
            next: (result) => {
                this.progressMode = 'upload';
                this.uploading = true;
                this.progress = { current: 0, total: result.totalEntries || this.entries.length, errors: [] };
            },
            error: (err) => {
                this.uploading = false;
                this.progress = null;
                this.error = err?.error?.error || 'Upload failed';
            }
        });
    }

    /**
     * Open a dialog to create a new instance of the bound recipe type.
     * The operator sets name and description.
     * On save, clones the type's entries with sanitized defaults.
     */
    onNew() {
        if (!this.typeDefinition) {
            // If type not loaded yet, load it from the API instead of failing
            this.loading = true;
            this.error = '';
            this.recipeService.getRecipe(this.typeId).subscribe({
                next: (type) => {
                    this.typeDefinition = type;
                    this.loading = false;
                    this._openNewDialog();
                },
                error: () => {
                    this.loading = false;
                    this.error = 'Recipe type not available';
                }
            });
            return;
        }
        this._openNewDialog();
    }

    /** Open the new-instance dialog using the loaded type definition */
    private _openNewDialog() {
        const sourceEntries = this.typeDefinition.entries.map(e => ({
            id: 'e_' + Math.random().toString(16).substring(2, 10),
            tagId: e.tagId,
            tagName: e.tagName,
            tagType: e.tagType,
            value: e.value !== undefined ? e.value : ''
        }));

        const dialogRef = this.dialog.open(HtmlRecipeNewDialogComponent, {
            data: { name: '', description: '' },
            disableClose: true
        });

        dialogRef.afterClosed().subscribe(result => {
            if (!result) return;

            this.saving = true;
            this.error = '';

            const entries = this._sanitizeEntries(sourceEntries);

            this.recipeService.saveRecipe({
                typeId: this.typeId,
                name: result.name.trim() || ('Instance ' + (this.instances.length + 1)),
                description: result.description.trim(),
                entries
            }).subscribe({
                next: (saveResult) => {
                    this.saving = false;
                    this.loadInstances();
                    if (saveResult?.id) {
                        this.currentInstanceId = saveResult.id;
                    }
                },
                error: (err) => {
                    this.error = err?.error?.error || 'Failed to create instance';
                    this.saving = false;
                }
            });
        });
    }

    /** Set the recipe type id (called from initElement with the designer property) */
    setTypeId(id: string) {
        this.typeId = id;
        if (id) {
            this.loadTypeDefinition();
            this.loadInstances();
        }
    }

    /** Configure the read-only mode for the widget */
    setReadonly(readonly: boolean) {
        this.readonly = readonly;
    }

    /** Return the badge colour for a given tag type */
    getTagTypeColor(tagType: string): string {
        switch (tagType?.toLowerCase()) {
            case 'boolean':
            case 'bool': return '#4caf50';
            case 'number':
            case 'int':
            case 'dint':
            case 'real':
            case 'float': return '#2196f3';
            default: return '#ff9800';
        }
    }

    /** Check whether a tag type belongs to the numeric family */
    isNumericType(tagType: string): boolean {
        const t = (tagType || '').toLowerCase();
        return ['number', 'int', 'dint', 'int16', 'int32', 'real', 'float', 'double', 'byte'].includes(t);
    }

    /** Check whether a tag type belongs to the string family */
    isStringType(tagType: string): boolean {
        const t = (tagType || '').toLowerCase();
        return ['string', 'word'].includes(t);
    }

    /** Apply designer colours to the widget */
    setColors(colors: { background?: string; text?: string; border?: string; accent?: string }) {
        if (colors) {
            this.backgroundColor = colors.background || this.backgroundColor;
            this.textColor = colors.text || this.textColor;
            this.borderColor = colors.border || this.borderColor;
            this.accentColor = colors.accent || this.accentColor;
        }
    }
}

/**
 * Static gauge component registration for the recipe widget.
 * This is the factory class that the gauge system uses to instantiate
 * HtmlRecipeViewComponent inside SVG editor canvases.
 */
@Component({
    template: ''
})
export class HtmlRecipeComponent extends GaugeBaseComponent {
    static TypeTag = 'svg-ext-own_ctrl-recipe';
    static LabelTag = 'HtmlRecipe';
    static prefixD = 'D-OXC_';

    constructor() {
        super();
    }

    static getDialogType(): GaugeDialogType {
        return GaugeDialogType.Recipe;
    }

    static getSignals(pro: any) {
        return [];
    }

    /** Initialise the recipe widget inside the SVG editor canvas */
    static initElement(
        gab: GaugeSettings,
        resolver: ComponentFactoryResolver,
        viewContainerRef: ViewContainerRef,
        isview: boolean
    ): HtmlRecipeViewComponent | null {
        console.log('[RecipeWidget] initElement called for', gab.id, 'type:', gab.type, 'property:', JSON.stringify(gab.property));
        const ele = document.getElementById(gab.id);
        if (!ele) {
            console.warn('[RecipeWidget] SVG element NOT FOUND for id', gab.id);
            return null;
        }
        console.log('[RecipeWidget] SVG element found', ele.tagName, ele.id, 'children:', ele.children.length);

        ele?.setAttribute('data-name', gab.name);

        const rect = ele.querySelector('rect');
        if (rect && !rect.hasAttribute('data-initialized')) {
            if (!rect.getAttribute('fill') ||
                rect.getAttribute('fill') === '#FFFFFF' ||
                rect.getAttribute('fill') === 'rgb(255, 255, 255)') {
                rect.setAttribute('fill', '#f9f9f9ff');
            }
            rect.setAttribute('data-initialized', 'true');
        }

        const htmlRecipe = Utils.searchTreeStartWith(ele, this.prefixD);
        if (!htmlRecipe) {
            console.warn('[RecipeWidget] container div D-OXC_ NOT FOUND inside', gab.id, 'prefix:', this.prefixD);
            return null;
        }
        console.log('[RecipeWidget] container div found', htmlRecipe.id);

        const factory = resolver.resolveComponentFactory(HtmlRecipeViewComponent);
        const componentRef: ComponentRef<HtmlRecipeViewComponent> = viewContainerRef.createComponent(factory);

        if (!gab.property) {
            gab.property = { recipeId: null, readonly: false };
        }

        gab.property.backgroundColor ??= '#f0f0f0';
        gab.property.textColor ??= '#505050';
        gab.property.borderColor ??= '#cccccc';
        gab.property.accentColor ??= '#2196f3';
        // New permission/visibility fields — additive defaults keep saved views valid (FR-31)
        gab.property.visibleActions ??= {};
        gab.property.visibleActions.new ??= true;
        gab.property.visibleActions.delete ??= true;
        gab.property.visibleActions.save ??= true;
        gab.property.visibleActions.download ??= true;
        gab.property.visibleActions.upload ??= true;

        htmlRecipe.innerHTML = '';
        // recipeId now stores the bound recipe type id
        componentRef.instance.isEditor = !isview;
        componentRef.instance.property = gab.property;
        componentRef.instance.setTypeId(gab.property.recipeId);
        componentRef.instance.setReadonly(gab.property.readonly);
        componentRef.instance.setColors({
            background: gab.property.backgroundColor,
            text: gab.property.textColor,
            border: gab.property.borderColor,
            accent: gab.property.accentColor
        });

        componentRef.changeDetectorRef.detectChanges();
        htmlRecipe.appendChild(componentRef.location.nativeElement);

        (componentRef.instance as any)['myComRef'] = componentRef;
        (componentRef.instance as any)['name'] = gab.name;
        console.log('[RecipeWidget] component created, typeId:', gab.property.recipeId, 'readonly:', gab.property.readonly);
        return componentRef.instance;
    }

    static detectChange(ga: GaugeSettings, res: any, ref: any) {
        return HtmlRecipeComponent.initElement(ga, res, ref, false);
    }
}
