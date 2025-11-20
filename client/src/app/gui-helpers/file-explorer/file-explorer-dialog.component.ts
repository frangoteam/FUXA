import { Component, Inject, ViewChild, HostListener } from '@angular/core';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { MatSelectionList, MatSelectionListChange } from '@angular/material/list';
import { ConfirmDialogComponent, ConfirmDialogData } from '../confirm-dialog/confirm-dialog.component';
import { TranslateService } from '@ngx-translate/core';
import { ToastNotifierService } from '../../_services/toast-notifier.service';
import { ResourcesBrowseItemType, ResourcesBrowseResponse, ResourcesService } from '../../_services/resources.service';
import { EditNameComponent } from '../edit-name/edit-name.component';
import { joinPath, normalizePath, getParentPath } from '../../_helpers/path-utils';

export interface FileExplorerDialogData {
    title?: string;
    initialPath?: string;
    selectDirectories?: boolean;
    selectFiles?: boolean;
    multiSelect?: boolean;
    allowedExtensions?: string[];
}

export interface FileSystemItem {
    name: string;
    type: 'directory' | 'file';
    path: string;
    size?: number;
    modified?: Date;
}

@Component({
    selector: 'app-file-explorer-dialog',
    templateUrl: './file-explorer-dialog.component.html',
    styleUrls: ['./file-explorer-dialog.component.scss']
})
export class FileExplorerDialogComponent {
    private _currentPath: string = '';
    private _rootPath: string = '';
    items: FileSystemItem[] = [];
    selectedItems: FileSystemItem[] = [];
    loading: boolean = false;
    lastSelectedIndex: number = -1;
    shiftPressed: boolean = false;
    ctrlPressed: boolean = false;

    @ViewChild('fileList') fileList!: MatSelectionList;

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: FileExplorerDialogData,
        private dialogRef: MatDialogRef<FileExplorerDialogComponent>,
        private translateService: TranslateService,
        private toastNotifier: ToastNotifierService,
        private resourcesService: ResourcesService,
        private dialog: MatDialog
    ) {
        this.currentPath = data.initialPath || '/tmp';
        this.loadDirectory(this.currentPath);
    }

    get currentPath(): string {
        return this._currentPath;
    }

    set currentPath(value: string) {
        this._currentPath = normalizePath(value);
    }

    loadDirectory(dirPath: string) {
        this.loading = true;
        this.selectedItems = [];
        this.lastSelectedIndex = -1;

        this.resourcesService.browse(dirPath).subscribe(
            (response: ResourcesBrowseResponse) => {
                this.currentPath = response.currentPath;
                this.items = response.items || [];
                this.loading = false;
                this._rootPath = normalizePath(response.rootPath);
            },
            (error) => {
                this.toastNotifier.notifyError('file-explorer.loading-directory-error', error.message);
                this.loading = false;
            });
    }

    @HostListener('window:keydown', ['$event'])
    onKeyDown(event: KeyboardEvent) {
        // Track modifier keys
        if (event.key === 'Shift') {
            this.shiftPressed = true;
        } else if (event.key === 'Control' || event.key === 'Meta') {
            this.ctrlPressed = true;
        }

        // Handle Delete key for deleting selected items
        if (event.key === 'Delete' && this.selectedItems.length > 0) {
            event.preventDefault();
            this.deleteSelected();
        }
    }

    @HostListener('window:keyup', ['$event'])
    onKeyUp(event: KeyboardEvent) {
        // Track modifier keys
        if (event.key === 'Shift') {
            this.shiftPressed = false;
        } else if (event.key === 'Control' || event.key === 'Meta') {
            this.ctrlPressed = false;
        }
    }

    onSelectionChange(event: MatSelectionListChange) {
        const selectedOptions = event.source.selectedOptions.selected;
        const lastSelectedOption = selectedOptions[selectedOptions.length - 1];

        if (!lastSelectedOption) return;

        const clickedItem = lastSelectedOption.value;
        const clickedIndex = this.items.findIndex(item => item.path === clickedItem.path);

        if (this.data.multiSelect) {
            if (this.shiftPressed && this.lastSelectedIndex !== -1) {
                // Range selection with Shift
                const startIndex = Math.min(this.lastSelectedIndex, clickedIndex);
                const endIndex = Math.max(this.lastSelectedIndex, clickedIndex);

                // Clear current selection and select range
                this.selectedItems = [];
                for (let i = startIndex; i <= endIndex; i++) {
                    this.selectedItems.push(this.items[i]);
                }
            } else if (this.ctrlPressed) {
                // Toggle selection with Ctrl/Cmd
                const existingIndex = this.selectedItems.findIndex(item => item.path === clickedItem.path);
                if (existingIndex !== -1) {
                    this.selectedItems.splice(existingIndex, 1);
                } else {
                    this.selectedItems.push(clickedItem);
                }
            } else {
                // Single selection
                this.selectedItems = [clickedItem];
            }
        } else {
            this.selectedItems = selectedOptions.map(option => option.value);
        }

        this.lastSelectedIndex = clickedIndex;
    }

    isSelected(item: FileSystemItem): boolean {
        return this.selectedItems.some(selected => selected.path === item.path);
    }

    onItemDoubleClick(item: FileSystemItem) {
        if (item.type === 'directory') {
            this.loadDirectory(normalizePath(item.path));
        } else if (this.data.selectFiles && this.isFileAllowed(item)) {
            this.selectedItems = [item];
            this.onSelect();
        }
    }

    isFileAllowed(item: FileSystemItem): boolean {
        if (!this.data.allowedExtensions || this.data.allowedExtensions.length === 0) {
            return true;
        }
        const extension = item.name.split('.').pop()?.toLowerCase();
        return extension ? this.data.allowedExtensions.includes(extension) : false;
    }

    goUp() {
        this.currentPath = getParentPath(this.currentPath);
        this.loadDirectory(this.currentPath);
    }

    canGoUp(): boolean {
        return this.currentPath !== '/';
    }

    canCreate(): boolean {
        return this.currentPath !== '/';
    }

    canDelete(): boolean {
        return this.currentPath !== '/' && this.selectedItems.length > 0;
    }

    refresh() {
        this.loadDirectory(this.currentPath);
    }

    getPath() {
        return this.currentPath.replace(this._rootPath, '');
    }

    createFolder() {
        let dialogRef = this.dialog.open(EditNameComponent, {
            position: { top: '60px' },
            data: {
                title: this.translateService.instant('file-explorer.directory-name-title')
            }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result && result.name.trim()) {
                const folderName = result.name.trim();
                const newPath = joinPath(this.currentPath, folderName);
                this.resourcesService.create(newPath, ResourcesBrowseItemType.directory).subscribe(
                    () => {
                        let msg = this.translateService.instant('file-explorer.directory-created', { folderName });
                        this.toastNotifier.toastrRef().success(msg);
                        this.refresh();
                    },
                    (error) => {
                        this.toastNotifier.notifyError('file-explorer.create-directory-error', error.message);
                    }
                );
            }
        });
    }

    createFile() {
        let dialogRef = this.dialog.open(EditNameComponent, {
            position: { top: '60px' },
            data: {
                title: this.translateService.instant('file-explorer.file-name-title')
            }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result && result.name.trim()) {
                const fileName = result.name.trim();
                const newPath = joinPath(this.currentPath, fileName);
                this.resourcesService.create(newPath, ResourcesBrowseItemType.file).subscribe(
                    () => {
                        let msg = this.translateService.instant('file-explorer.file-created', { fileName });
                        this.toastNotifier.toastrRef().success(msg);
                        this.refresh();
                    },
                    (error) => {
                        this.toastNotifier.notifyError('file-explorer.create-file-error', error.message);
                    }
                );
            }
        });
    }

    deleteSelected() {
        if (this.selectedItems.length === 0) return;

        const itemNames = this.selectedItems.map(item => `"${item.name}"`).join(', ');
        const msg = this.translateService.instant('file-explorer.file-to-delete', { itemNames });
        const dialogData: ConfirmDialogData = { msg };
        const dialogRef = this.dialog.open(ConfirmDialogComponent, {
            width: '400px',
            data: dialogData
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.performDelete();
            }
        });
    }

    private performDelete() {
        let completed = 0;
        let errors = 0;

        this.selectedItems.forEach(item => {
            this.resourcesService.delete(item.path, ResourcesBrowseItemType.file).subscribe(
                () => {
                    completed++;
                    if (completed + errors === this.selectedItems.length) {
                        this.showDeleteResult(completed, errors);
                        this.refresh();
                    }
                },
                (error) => {
                    errors++;
                    if (completed + errors === this.selectedItems.length) {
                        this.showDeleteResult(completed, errors);
                    }
                }
            );
        });
    }

    private showDeleteResult(successCount: number, errorCount: number) {

        if (errorCount === 0) {
            let msg = this.translateService.instant('file-explorer.delete-element', { successCount });
            this.toastNotifier.toastrRef().success(msg);
        } else {
            let msg = this.translateService.instant('file-explorer.delete-element-error', { successCount, errorCount });
            this.toastNotifier.toastrRef().warning(msg);
        }
    }

    getItemIcon(item: FileSystemItem): string {
        if (item.type === 'directory') {
            return 'folder';
        }

        // File type icons based on extension
        const extension = item.name.split('.').pop()?.toLowerCase();
        switch (extension) {
            case 'pdf': return 'picture_as_pdf';
            case 'txt':
            case 'md': return 'description';
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'gif': return 'image';
            case 'mp4':
            case 'avi':
            case 'mov': return 'videocam';
            case 'mp3':
            case 'wav': return 'audiotrack';
            case 'zip':
            case 'rar':
            case '7z': return 'archive';
            default: return 'insert_drive_file';
        }
    }

    formatSize(size?: number): string {
        if (!size || size === 0) return '';
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
        if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
        return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }

    hasValidSelection(): boolean {
        if (this.selectedItems.length === 0) return false;

        return this.selectedItems.every(item => {
            if (this.data.selectDirectories && item.type === 'directory') return true;
            if (this.data.selectFiles && item.type === 'file' && this.isFileAllowed(item)) return true;
            return false;
        });
    }

    onSelect() {
        if (this.hasValidSelection()) {
            this.dialogRef.close(this.data.multiSelect ? this.selectedItems : this.selectedItems[0]);
        }
    }

    onCancel() {
        this.dialogRef.close(null);
    }
}
