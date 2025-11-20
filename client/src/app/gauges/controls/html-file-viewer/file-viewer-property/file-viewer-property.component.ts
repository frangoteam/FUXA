import { Component, EventEmitter, OnInit, Input, Output } from '@angular/core';

import { TranslateService } from '@ngx-translate/core';
import { GaugeFileViewerProperty } from '../../../../_models/hmi';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { FileExplorerDialogComponent, FileExplorerDialogData, FileSystemItem } from '../../../../gui-helpers/file-explorer/file-explorer-dialog.component';
import { PermissionData, PermissionDialogComponent } from '../../../gauge-property/permission-dialog/permission-dialog.component';

@Component({
    selector: 'app-file-viewer-property',
    templateUrl: './file-viewer-property.component.html',
    styleUrls: ['./file-viewer-property.component.scss']
})
export class FileViewerPropertyComponent implements OnInit {

    @Input() data: any;
    @Output() onPropChanged: EventEmitter<any> = new EventEmitter();
    @Input('reload') set reload(b: any) {
        this._reload();
    }

    property: GaugeFileViewerProperty;

    constructor(
        private translateService: TranslateService,
        private dialog: MatDialog) {
    }

    ngOnInit() {
        this._reload();
    }

    onPropertyChanged() {
        this.onPropChanged.emit(this.data.settings);
    }

    onBrowseDirectory() {
        const dialogData: FileExplorerDialogData = {
            title: this.translateService.instant('file-explorer.select-directory-title'),
            selectDirectories: true,
            selectFiles: false,
            initialPath: this.property.directory || '/_reports/generated'
        };

        const dialogRef = this.dialog.open(FileExplorerDialogComponent, {
            disableClose: true,
            data: dialogData,
            position: { top: '60px' },
            panelClass: 'file-explorer-dialog-panel'
        });

        dialogRef.afterClosed().subscribe((result: FileSystemItem) => {
            if (result?.path) {
                this.property.directory = result.path;
                this.onPropertyChanged();
            }
        });
    }

    onEditPermission() {
        const dialogRef = this.dialog.open(PermissionDialogComponent, {
            position: { top: '60px' },
            data: <PermissionData>{
                permission: this.property.permission,
                permissionRoles: this.property.permissionRoles
            }
        });

        dialogRef.afterClosed().subscribe((result: PermissionData) => {
            if (result) {
                this.property.permission = result.permission;
                this.property.permissionRoles = result.permissionRoles;
                this.onPropertyChanged();
            }
        });
    }

    private _reload() {
        if (!this.data.settings.property) {
            this.data.settings.property = <GaugeFileViewerProperty>{
                directory: '/_reports/generated',
                headerText: 'File Viewer',
                viewEnabled: false,
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
        }

        // Set default color scheme if not already set
        if (!this.data.settings.property.accentColor) {
            this.data.settings.property.accentColor = '#556e82';
        }
        if (!this.data.settings.property.backgroundColor) {
            this.data.settings.property.backgroundColor = '#f0f0f0';
        }
        if (!this.data.settings.property.borderColor) {
            this.data.settings.property.borderColor = '#cccccc';
        }
        if (!this.data.settings.property.textColor) {
            this.data.settings.property.textColor = '#505050';
        }
        if (!this.data.settings.property.secondaryTextColor) {
            this.data.settings.property.secondaryTextColor = '#ffffff';
        }
        if (!this.data.settings.property.fileTypeFilter) {
            this.data.settings.property.fileTypeFilter = 'all';
        }
        if (!this.data.settings.property.dateFilter) {
            this.data.settings.property.dateFilter = {
                enabled: false,
                startDate: '',
                endDate: ''
            };
        }

        this.property = this.data.settings.property;
    }
}
