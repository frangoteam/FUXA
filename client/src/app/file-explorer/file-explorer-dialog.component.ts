import { Component, Inject, ViewChild, HostListener } from '@angular/core';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { MatSelectionList, MatSelectionListChange } from '@angular/material/list';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ConfirmDialogComponent, ConfirmDialogData } from '../gui-helpers/confirm-dialog/confirm-dialog.component';

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
    styleUrls: ['./file-explorer-dialog.component.css']
})
export class FileExplorerDialogComponent {

    currentPath: string = '';
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
        private http: HttpClient,
        private snackBar: MatSnackBar,
        private dialog: MatDialog
    ) {
        this.currentPath = data.initialPath || '/tmp';
        this.loadDirectory(this.currentPath);
    }

    loadDirectory(dirPath: string) {
        this.loading = true;
        this.selectedItems = [];
        this.lastSelectedIndex = -1;

        // Add authorization header to prevent direct API access
        const headers = new HttpHeaders({
            'X-File-Explorer-Request': 'true'
        });

        this.http.get(`/api/resources/browse?path=${encodeURIComponent(dirPath)}`, { headers })
            .subscribe({
                next: (response: any) => {
                    this.currentPath = response.currentPath;
                    this.items = response.items || [];
                    this.loading = false;
                },
                error: (error) => {
                    this.snackBar.open('Error loading directory: ' + error.message, 'OK', { duration: 3000 });
                    this.loading = false;
                }
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
            this.loadDirectory(item.path);
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
        const pathParts = this.currentPath.split('/').filter(p => p);
        if (pathParts.length > 1) {
            pathParts.pop();
            const parentPath = '/' + pathParts.join('/');
            this.loadDirectory(parentPath);
        } else if (this.currentPath !== '/') {
            this.loadDirectory('/');
        }
    }

    canGoUp(): boolean {
        return this.currentPath !== '/';
    }

    refresh() {
        this.loadDirectory(this.currentPath);
    }

    createFolder() {
        const folderName = prompt('Enter folder name:');
        if (folderName && folderName.trim()) {
            const newPath = this.currentPath + '/' + folderName.trim();

            const headers = new HttpHeaders({
                'X-File-Explorer-Request': 'true'
            });

            this.http.post('/api/resources/browse/create', { path: newPath }, { headers })
                .subscribe({
                    next: () => {
                        this.snackBar.open(`Folder "${folderName}" created`, 'OK', { duration: 2000 });
                        this.refresh();
                    },
                    error: (error) => {
                        this.snackBar.open('Error creating folder: ' + error.message, 'OK', { duration: 3000 });
                    }
                });
        }
    }

    createFile() {
        const fileName = prompt('Enter file name:');
        if (fileName && fileName.trim()) {
            const newPath = this.currentPath + '/' + fileName.trim();

            const headers = new HttpHeaders({
                'X-File-Explorer-Request': 'true'
            });

            // Create empty file
            this.http.post('/api/resources/browse/create-file', { path: newPath }, { headers })
                .subscribe({
                    next: () => {
                        this.snackBar.open(`File "${fileName}" created`, 'OK', { duration: 2000 });
                        this.refresh();
                    },
                    error: (error) => {
                        this.snackBar.open('Error creating file: ' + error.message, 'OK', { duration: 3000 });
                    }
                });
        }
    }

    deleteSelected() {
        if (this.selectedItems.length === 0) return;

        const itemNames = this.selectedItems.map(item => `"${item.name}"`).join(', ');
        const dialogData: ConfirmDialogData = {
            msg: `Are you sure you want to delete ${this.selectedItems.length === 1 ? 'this item' : 'these items'}: ${itemNames}?`
        };

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

        const headers = new HttpHeaders({
            'X-File-Explorer-Request': 'true'
        });

        this.selectedItems.forEach(item => {
            this.http.delete(`/api/resources/browse?path=${encodeURIComponent(item.path)}`, { headers })
                .subscribe({
                    next: () => {
                        completed++;
                        if (completed + errors === this.selectedItems.length) {
                            this.showDeleteResult(completed, errors);
                            this.refresh();
                        }
                    },
                    error: (error) => {
                        errors++;
                        if (completed + errors === this.selectedItems.length) {
                            this.showDeleteResult(completed, errors);
                        }
                    }
                });
        });
    }

    private showDeleteResult(successCount: number, errorCount: number) {
        if (errorCount === 0) {
            this.snackBar.open(`${successCount} item(s) deleted successfully`, 'OK', { duration: 2000 });
        } else if (successCount === 0) {
            this.snackBar.open(`Failed to delete ${errorCount} item(s)`, 'OK', { duration: 3000 });
        } else {
            this.snackBar.open(`${successCount} deleted, ${errorCount} failed`, 'OK', { duration: 3000 });
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

    getSelectButtonText(): string {
        if (this.data.multiSelect && this.selectedItems.length > 1) {
            return `Select ${this.selectedItems.length} Items`;
        }
        return 'Select';
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