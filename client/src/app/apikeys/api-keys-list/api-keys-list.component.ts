import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatLegacyTable as MatTable, MatLegacyTableDataSource as MatTableDataSource } from '@angular/material/legacy-table';
import { MatLegacyDialog as MatDialog} from '@angular/material/legacy-dialog';
import { MatLegacySnackBar as MatSnackBar } from '@angular/material/legacy-snack-bar';
import { MatSort } from '@angular/material/sort';
import { Subject, takeUntil } from 'rxjs';
import { ProjectService } from '../../_services/project.service';
import { TranslateService } from '@ngx-translate/core';
import { ApiKey } from '../../_models/apikey';
import { ConfirmDialogComponent } from '../../gui-helpers/confirm-dialog/confirm-dialog.component';
import { ApiKeyPropertyComponent } from '../api-key-property/api-key-property.component';
import { ApiKeysService } from '../../_services/apikeys.service';

@Component({
    selector: 'app-api-keys-list',
    templateUrl: './api-keys-list.component.html',
    styleUrls: ['./api-keys-list.component.scss']
})
export class ApiKeysListComponent implements OnInit, AfterViewInit, OnDestroy {

    displayedColumns = ['select', 'name', 'key', 'description', 'created', 'expires', 'enabled', 'remove'];
    id: string;
    name: string;
    key: string;
    description: string;
    created: string;
    expires: string;
    enabled: boolean;
    dataSource = new MatTableDataSource([]);
    apikeys: ApiKey[];

    private destroy$ = new Subject<void>();

    @ViewChild(MatTable, {static: true}) table: MatTable<any>;
    @ViewChild(MatSort, {static: false}) sort: MatSort;

    constructor(
        private dialog: MatDialog,
        private translateService: TranslateService,
        private projectService: ProjectService,
        private apiKeysService: ApiKeysService,
        private snackBar: MatSnackBar
    ) { }

    ngOnInit() {
        this.loadApiKeys();
        this.projectService.onLoadHmi.pipe(
            takeUntil(this.destroy$)
        ).subscribe(_ => {
            this.loadApiKeys();
        });
    }

    ngAfterViewInit() {
        this.dataSource.sort = this.sort;
    }

    ngOnDestroy() {
        this.destroy$.next(null);
        this.destroy$.complete();
    }

    onAddApiKey() {
		this.editApiKey();
    }

    onEditApiKey(apiKey: ApiKey) {
		this.editApiKey(apiKey);
    }

    copyApiKey(event: MouseEvent, key: string) {
        event?.stopPropagation();
        if (!key) {
            return;
        }
        const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
        if (clipboard?.writeText) {
            clipboard.writeText(key).then(() => this.showCopyMessage()).catch(() => this.fallbackCopy(key));
        } else {
            this.fallbackCopy(key);
        }
    }

    onRemoveApiKey(apiKey: ApiKey) {
        let msg = this.translateService.instant('msg.apikeys-remove', { value: apiKey.name });
        let dialogRef = this.dialog.open(ConfirmDialogComponent, {
            data: { msg: msg },
            position: { top: '60px' }
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result && apiKey) {
                this.apiKeysService.removeApiKey(apiKey).subscribe(result => {
                    this.loadApiKeys();
                }, err => {
                    console.error('remove ApiKey err: ' + err);
                });
            }
        });
    }

    private loadApiKeys() {
        this.apikeys = [];
        this.apiKeysService.getApiKeys().subscribe(result => {
            this.bindToTable(result);
        }, err => {
            console.error('get Roles err: ' + err);
        });
    }

    private bindToTable(apikeys: ApiKey[]) {
        this.dataSource.data = apikeys;
    }

    private editApiKey(apiKey?: ApiKey) {
        let dialogRef = this.dialog.open(ApiKeyPropertyComponent, {
            position: { top: '60px' },
            disableClose: true,
            data: apiKey ? { ...apiKey } : null,
        });
        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.apiKeysService.setApiKey(result).subscribe(() => {
                    this.loadApiKeys();
                });
            }
        });
    }

    private fallbackCopy(value: string) {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        try {
            document.execCommand('copy');
            this.showCopyMessage();
        } catch (err) {
            console.error('copy ApiKey err: ', err);
        } finally {
            document.body.removeChild(textarea);
        }
    }

    private showCopyMessage() {
        const message = this.translateService.instant('msg.apikeys-copied');
        if (message) {
            this.snackBar.open(message, undefined, { duration: 2000 });
        }
    }
}
