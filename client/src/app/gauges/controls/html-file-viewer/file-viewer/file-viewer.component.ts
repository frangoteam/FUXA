import { Component, OnInit, OnDestroy, Input, ViewChild, ElementRef, AfterViewInit, HostListener } from '@angular/core';
import { GaugeSettings } from '../../../../_models/hmi';
import { HttpClient } from '@angular/common/http';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { AuthService } from '../../../../_services/auth.service';
import { GaugeFileViewerProperty } from '../../../../_models/hmi';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TranslateService } from '@ngx-translate/core';
import { ResourcesBrowseResponse, ResourcesService } from '../../../../_services/resources.service';
import { ToastNotifierService } from '../../../../_services/toast-notifier.service';

interface FileItem {
    name: string;
    type: 'directory' | 'file';
    path: string;
    size?: number;
    modified: Date;
    relativePath?: string;
}

@Component({
    selector: 'app-file-viewer',
    templateUrl: './file-viewer.component.html',
    styleUrls: ['./file-viewer.component.scss']
})
export class FileViewerComponent implements OnInit, OnDestroy, AfterViewInit {
    @Input() settings: GaugeSettings;
    @ViewChild('fileViewerContainer', { static: true }) fileViewerContainer: ElementRef;
    @Input() isEditor: boolean = false;

    property: GaugeFileViewerProperty;
    files: FileItem[] = [];
    filteredFiles: FileItem[] = [];
    selectedFile: FileItem | null = null;
    fileUrl: SafeResourceUrl = '';
    searchTerm: string = '';
    sortBy: string = 'date';
    sortOrder: string = 'desc';
    showFileList: boolean = true;
    showDateFilter: boolean = true;
    sortByDropdownOpen: boolean = false;
    sortOrderDropdownOpen: boolean = false;
    hoveredSortBy: string | null = null;
    hoveredSortOrder: string | null = null;

    constructor(
        private http: HttpClient,
        private toastNotifier: ToastNotifierService,
        private snackBar: MatSnackBar,
        private authService: AuthService,
        private sanitizer: DomSanitizer,
        private translateService: TranslateService,
        private resourcesService: ResourcesService,
    ) {}

    ngOnInit() {
        this.property = this.settings.property as GaugeFileViewerProperty;

        // Ensure property has the correct structure
        if (!this.property) {
            this.property = {
                directory: '',
                headerText: 'File Viewer',
                viewEnabled: true,
                deleteEnabled: false,
                permission: 0,
                accentColor: '#556e82',
                backgroundColor: '#f0f0f0',
                borderColor: '#cccccc',
                textColor: '#505050',
                secondaryTextColor: '#ffffff',
                fileTypeFilter: 'all',
                dateFilter: {
                    enabled: false,
                    startDate: '',
                    endDate: ''
                }
            };
        } else {
            // Ensure all required properties exist
            if (this.property.viewEnabled === undefined) {
                this.property.viewEnabled = false;
            }
            if (this.property.deleteEnabled === undefined) {
                this.property.deleteEnabled = false;
            }
            if (this.property.permission === undefined) {
                this.property.permission = 0;
            }
            if (!this.property.headerText) {
                this.property.headerText = 'File Viewer';
            }
            if (!this.property.accentColor) {
                this.property.accentColor = '#556e82';
            }
            if (!this.property.backgroundColor) {
                this.property.backgroundColor = '#f0f0f0';
            }
            if (!this.property.borderColor) {
                this.property.borderColor = '#cccccc';
            }
            if (!this.property.textColor) {
                this.property.textColor = '#505050';
            }
            if (!this.property.secondaryTextColor) {
                this.property.secondaryTextColor = '#ffffff';
            }
            if (!this.property.fileTypeFilter) {
                this.property.fileTypeFilter = 'all';
            }
            if (!this.property.dateFilter) {
                this.property.dateFilter = {
                    enabled: true,
                    startDate: '',
                    endDate: ''
                };
            }
        }
        this.loadFiles();
    }

    ngAfterViewInit() {
        // Set CSS custom properties for theme colors to style mat-select dropdowns
        if (this.fileViewerContainer) {
            const element = this.fileViewerContainer.nativeElement;

            if (this.property.backgroundColor) {
                element.style.setProperty('--file-viewer-bg-color', this.property.backgroundColor);
            }
            if (this.property.textColor) {
                element.style.setProperty('--file-viewer-text-color', this.property.textColor);
            }
            if (this.property.secondaryTextColor) {
                element.style.setProperty('--file-viewer-secondary-text-color', this.property.secondaryTextColor);
            }
            if (this.property.borderColor) {
                element.style.setProperty('--file-viewer-border-color', this.property.borderColor);
            }
            if (this.property.accentColor) {
                // Create hover color from accent color with transparency
                const hoverColor = this.hexToRgba(this.property.accentColor, 0.12);
                element.style.setProperty('--file-viewer-hover-color', hoverColor);
            }
        }
    }

    ngOnDestroy() {
        // Cleanup if needed
    }

    loadFiles() {
        if (!this.property.directory) {
            console.log('No directory specified');
            return;
        }

        this.resourcesService.browse(this.property.directory).subscribe(
            (response: ResourcesBrowseResponse) => {
                this.files = response.items.map((item: any) => ({
                    ...item,
                    modified: new Date(item.modified)
                })).filter((item: FileItem) => item.type === 'file' && this.isSupportedFile(item.name));
                this.filterFiles();
                this.sortFiles();
            },
            (error) => {
                this.toastNotifier.notifyError('file-explorer.loading-directory-error', this.isEditor ? error.message : null);
            });
    }

    filterFiles() {
        this.filteredFiles = this.files.filter(file => {
            // Search term filter
            const matchesSearch = file.name.toLowerCase().includes(this.searchTerm.toLowerCase());

            // File type filter
            let matchesType = true;
            if (this.property.fileTypeFilter !== 'all') {
                const extension = file.name.split('.').pop()?.toLowerCase();
                switch (this.property.fileTypeFilter) {
                    case 'pdf':
                        matchesType = extension === 'pdf';
                        break;
                    case 'txt':
                        matchesType = extension === 'txt';
                        break;
                    case 'csv':
                        matchesType = extension === 'csv';
                        break;
                    case 'log':
                        matchesType = extension === 'log';
                        break;
                }
            }

            // Date range filter
            let matchesDate = true;
            if (this.property.dateFilter?.enabled) {
                const fileDate = new Date(file.modified);
                if (this.property.dateFilter.startDate) {
                    const startDate = new Date(this.property.dateFilter.startDate);
                    matchesDate = matchesDate && fileDate >= startDate;
                }
                if (this.property.dateFilter.endDate) {
                    const endDate = new Date(this.property.dateFilter.endDate);
                    // Set end date to end of day
                    endDate.setHours(23, 59, 59, 999);
                    matchesDate = matchesDate && fileDate <= endDate;
                }
            }

            return matchesSearch && matchesType && matchesDate;
        });
    }

    sortFiles() {
        this.filteredFiles.sort((a, b) => {
            let comparison = 0;
            if (this.sortBy === 'name') {
                comparison = a.name.localeCompare(b.name);
            } else if (this.sortBy === 'date') {
                comparison = a.modified.getTime() - b.modified.getTime();
            }
            return this.sortOrder === 'asc' ? comparison : -comparison;
        });
    }

    toggleDateFilter() {
        this.showDateFilter = !this.showDateFilter;
    }

    selectFile(file: FileItem) {
        this.selectedFile = file;
        this.fileUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
          `/api/resources/stream?path=${encodeURIComponent(file.relativePath || file.path)}`
        );
        this.showFileList = false;
        this.loadFiles();
    }

    openFileSelector() {
        this.showFileList = true;
    }

    openFileSelectorWithRefresh() {
        this.loadFiles();
        this.showFileList = true;
    }

    deleteFile(file: FileItem) {
        // Get File Viewer component position for centering
        const fileViewerElement = this.fileViewerContainer.nativeElement;
        const rect = fileViewerElement.getBoundingClientRect();
        const componentCenterX = rect.left + (rect.width / 2);
        const componentCenterY = rect.top + (rect.height / 2);

        // Create custom overlay dialog centered on the File Viewer component
        const overlay = document.createElement('div');
        overlay.className = 'file-viewer-custom-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 10000;
        `;

        const dialog = document.createElement('div');
        dialog.className = 'file-viewer-custom-dialog';
        dialog.style.cssText = `
            background-color: ${this.property?.backgroundColor || '#ffffff'};
            border: 1px solid ${this.property?.borderColor || '#cccccc'};
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            min-width: 320px;
            max-width: 500px;
            overflow: hidden;
            position: relative;
            transform: translate(-50%, -50%);
            left: ${componentCenterX}px;
            top: ${componentCenterY}px;
        `;

        const header = document.createElement('div');
        header.className = 'dialog-header';
        header.style.cssText = `
            padding: 16px 24px;
            background-color: ${this.property?.accentColor || '#2196f3'};
            color: white;
        `;

        const title = document.createElement('h3');
        title.textContent = 'Delete File';
        title.style.cssText = `
            margin: 0;
            font-size: 18px;
            font-weight: 500;
        `;

        const content = document.createElement('div');
        content.className = 'dialog-content';
        content.style.cssText = `
            padding: 20px 24px;
            color: ${this.property?.textColor || '#333333'};
        `;

        const message = document.createElement('p');
        message.textContent = `Are you sure you want to delete "${file.name}"? This action cannot be undone.`;
        message.style.cssText = `
            margin: 0;
            font-size: 14px;
            line-height: 1.5;
        `;

        const actions = document.createElement('div');
        actions.className = 'dialog-actions';
        actions.style.cssText = `
            padding: 12px 24px 20px 24px;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
        `;

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = this.translateService.instant('dlg.cancel');
        cancelBtn.style.cssText = `
            min-width: 80px;
            padding: 8px 16px;
            border: 1px solid ${this.property?.accentColor || '#2196f3'};
            background: transparent;
            color: ${this.property?.accentColor || '#2196f3'};
            border-radius: 4px;
            font-weight: 500;
            cursor: pointer;
        `;

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = this.translateService.instant('file-viewer.delete');
        deleteBtn.style.cssText = `
            min-width: 80px;
            padding: 8px 16px;
            border: none;
            background-color: ${this.property?.accentColor || '#2196f3'};
            color: white;
            border-radius: 4px;
            font-weight: 500;
            cursor: pointer;
        `;

        // Add hover effects
        cancelBtn.onmouseover = () => {
            cancelBtn.style.backgroundColor = `${this.property?.accentColor || '#2196f3'}10`;
        };
        cancelBtn.onmouseout = () => {
            cancelBtn.style.backgroundColor = 'transparent';
        };

        deleteBtn.onmouseover = () => {
            const accentColor = this.property?.accentColor || '#2196f3';
            const darkerColor = this.adjustColorBrightness(accentColor, -20);
            deleteBtn.style.backgroundColor = darkerColor;
        };
        deleteBtn.onmouseout = () => {
            deleteBtn.style.backgroundColor = this.property?.accentColor || '#2196f3';
        };

        // Event handlers
        const closeDialog = () => {
            document.body.removeChild(overlay);
        };

        cancelBtn.onclick = closeDialog;

        deleteBtn.onclick = () => {
            closeDialog();
            this.http.delete(`/api/resources/browse?path=${encodeURIComponent(file.path)}`)
                .subscribe({
                    next: () => {
                        this.snackBar.open('File deleted successfully', 'OK', { duration: 2000 });
                        this.loadFiles();
                    },
                    error: (error) => {
                        this.snackBar.open('Error deleting file: ' + error.message, 'OK', { duration: 3000 });
                    }
                });
        };

        overlay.onclick = (e) => {
            if (e.target === overlay) {
                closeDialog();
            }
        };

        // Assemble the dialog
        header.appendChild(title);
        content.appendChild(message);
        actions.appendChild(cancelBtn);
        actions.appendChild(deleteBtn);

        dialog.appendChild(header);
        dialog.appendChild(content);
        dialog.appendChild(actions);

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
    }

    private adjustColorBrightness(color: string, amount: number): string {
        // Simple color brightness adjustment for hover effects
        const usePound = color[0] === '#';
        const col = usePound ? color.slice(1) : color;

        const num = parseInt(col, 16);
        let r = (num >> 16) + amount;
        let g = (num >> 8 & 0x00FF) + amount;
        let b = (num & 0x0000FF) + amount;

        r = r > 255 ? 255 : r < 0 ? 0 : r;
        g = g > 255 ? 255 : g < 0 ? 0 : g;
        b = b > 255 ? 255 : b < 0 ? 0 : b;

        return (usePound ? '#' : '') + (r << 16 | g << 8 | b).toString(16);
    }

    get canView(): boolean {
        if (!this.property.viewEnabled) {
            return true; // Anyone can view when view permissions are disabled
        }
        const perm = this.authService.checkPermission(this.property);
        return perm ? perm.show : false;
    }

    get canDelete(): boolean {
        if (!this.property.deleteEnabled) {
            return false;
        }
        const perm = this.authService.checkPermission(this.property);
        return perm ? perm.enabled : false;
    }

    getFileIcon(file: FileItem): string {
        const ext = file.name.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'pdf': return 'picture_as_pdf';
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'gif': return 'image';
            case 'txt':
            case 'json': return 'description';
            default: return 'insert_drive_file';
        }
    }

    isSupportedFile(filename: string): boolean {
        const ext = filename.split('.').pop()?.toLowerCase();
        return ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'txt', 'json'].includes(ext || '');
    }

    // Custom dropdown methods
    getSelectStyles(): { [key: string]: string } {
        return {
            'background-color': this.property?.backgroundColor ? this.hexToRgba(this.property.backgroundColor, 0.9) : 'rgba(255, 255, 255, 0.9)',
            'border': `1px solid ${this.property?.borderColor || '#cccccc'}`,
            'color': this.property?.textColor || '#333333',
            'border-radius': '4px',
            'padding': '4px 6px',
            'height': '24px',
            'display': 'flex',
            'align-items': 'center',
            'cursor': 'pointer',
            'min-width': '70px',
            'max-width': '90px',
            'font-size': '11px'
        };
    }

    getSortByLabel(): string {
        switch (this.sortBy) {
            case 'name': return this.translateService.instant('file-viewer.sort-name');
            case 'date': return this.translateService.instant('file-viewer.sort-date');
            default: return 'Name';
        }
    }

    getSortOrderLabel(): string {
        switch (this.sortOrder) {
            case 'asc': return this.translateService.instant('file-viewer.asc');
            case 'desc': return this.translateService.instant('file-viewer.desc');
            default: return 'Ascending';
        }
    }

    toggleSortByDropdown(): void {
        this.sortByDropdownOpen = !this.sortByDropdownOpen;
        this.sortOrderDropdownOpen = false; // Close other dropdown
    }

    toggleSortOrderDropdown(): void {
        this.sortOrderDropdownOpen = !this.sortOrderDropdownOpen;
        this.sortByDropdownOpen = false; // Close other dropdown
    }

    selectSortBy(value: string): void {
        this.sortBy = value;
        this.sortByDropdownOpen = false;
        this.hoveredSortBy = null;
        this.sortFiles();
    }

    selectSortOrder(value: string): void {
        this.sortOrder = value;
        this.sortOrderDropdownOpen = false;
        this.hoveredSortOrder = null;
        this.sortFiles();
    }

    closeSortByDropdown(): void {
        this.sortByDropdownOpen = false;
        this.hoveredSortBy = null;
    }

    closeSortOrderDropdown(): void {
        this.sortOrderDropdownOpen = false;
        this.hoveredSortOrder = null;
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: Event): void {
        if (this.fileViewerContainer && !this.fileViewerContainer.nativeElement.contains(event.target)) {
            this.closeSortByDropdown();
            this.closeSortOrderDropdown();
        }
    }

    private hexToRgba(hex: string, alpha: number): string {
        try {
            const originalHex = hex;
            // Remove # if present
            hex = hex.replace('#', '');

            // Handle 3-digit hex codes
            if (hex.length === 3) {
                hex = hex.split('').map(char => char + char).join('');
            }

            // Ensure we have a 6-digit hex
            if (hex.length !== 6) {
                return `rgba(33, 150, 243, ${alpha})`; // Fallback to blue
            }

            // Parse hex values using substring instead of substr (deprecated)
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);

            // Validate the parsed values
            if (isNaN(r) || isNaN(g) || isNaN(b)) {
                return `rgba(33, 150, 243, ${alpha})`; // Fallback to blue
            }

            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        } catch (error) {
            console.error('Error converting hex to rgba:', error);
            // Fallback to blue if anything goes wrong
            return `rgba(33, 150, 243, ${alpha})`;
        }
    }
}
