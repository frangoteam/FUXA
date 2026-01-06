import { Component, EventEmitter, Inject, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { Subject, filter, takeUntil } from 'rxjs';
import { MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';
import { MatLegacyTableDataSource as MatTableDataSource } from '@angular/material/legacy-table';
import { MatLegacyPaginator as MatPaginator } from '@angular/material/legacy-paginator';
import { MatSort } from '@angular/material/sort';
import { SelectionModel } from '@angular/cdk/collections';
import { HmiService } from '../../../../_services/hmi.service';
import { Device } from '../../../../_models/device';

@Component({
    selector: 'app-tag-property-redis-scan',
    templateUrl: './tag-property-redis-scan.component.html',
    styleUrls: ['./tag-property-redis-scan.component.scss']
})
export class TagPropertyRedisScanComponent implements OnInit, OnDestroy {
    @Output() result = new EventEmitter<TagPropertyRedisResult>();
    private destroy$ = new Subject<void>();

    displayedColumns = ['select', 'address', 'type'];
    dataSource = new MatTableDataSource<RedisKeyRow>([]);
    selection = new SelectionModel<RedisKeyRow>(true, []);

    loading = false;
    match = '*';
    max = 100_000;
    countHint = 2000;

    existingKeys = new Set<string>();

    /** header checkbox helpers (consider ONLY the selectable rows) */
    selectableCountFiltered = 0;
    allFilteredSelected = false;
    someFilteredSelected = false;

    @ViewChild(MatPaginator, { static: true }) paginator!: MatPaginator;
    @ViewChild(MatSort, { static: true }) sort!: MatSort;

    constructor(
        private hmiService: HmiService,
        private dialogRef: MatDialogRef<TagPropertyRedisScanComponent>,
        @Inject(MAT_DIALOG_DATA) public data: TagPropertyRedisScanData
    ) { }

    ngOnInit() {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;

        this.dataSource.filterPredicate = (row, filter) => {
            const f = (filter || '').trim().toLowerCase();
            if (!f) {
                return true;
            }
            return row.address.toLowerCase().includes(f) || (row.type || '').toLowerCase().includes(f);
        };

        if (Array.isArray(this.data?.existing)) {
            for (const k of this.data.existing) {
                this.existingKeys.add(k);
            }
        }

        // result browse (one-shot)
        this.hmiService.onDeviceBrowse
            .pipe(takeUntil(this.destroy$), filter(res => !!res))
            .subscribe((res: any) => {
                const items: RedisKeyRow[] = (res?.result?.items || []).map((x: any) => ({ address: x.address, type: x.type || 'unknown' }));
                const limited = items.slice(0, this.max);
                this.dataSource.data = limited;

                // PRE-SELECT existing ones (checkbox true, but not toggleable)
                const preselected = limited.filter(r => this.existingKeys.has(r.address));
                if (preselected.length) {
                    this.selection.select(...preselected);
                }

                this.loading = false;
                this.refreshSelectHelpers();
            });

        this.runScan();
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    runScan() {
        this.selection.clear();
        this.loading = true;

        const node = {
            match: this.match || '*',
            count: this.countHint,
            max: this.max,
            includeType: true
        };
        this.hmiService.askDeviceBrowse(this.data.device.id, node);
    }

    applyFilter(ev: Event) {
        const value = (ev.target as HTMLInputElement).value || '';
        this.dataSource.filter = value.trim().toLowerCase();
        if (this.dataSource.paginator) {
            this.dataSource.paginator.firstPage();
        }
        this.refreshSelectHelpers();
    }

    isRowSelectable(row: RedisKeyRow) {
        return !this.existingKeys.has(row.address);
    }

    toggleRow(row: RedisKeyRow) {
        if (!this.isRowSelectable(row)) {
            return;
        }
        this.selection.toggle(row);
        this.refreshSelectHelpers();
    }

    toggleSelectAllFiltered() {
        const filtered = this.getFilteredRows().filter(r => this.isRowSelectable(r));
        if (filtered.length === 0) {
            return;
        }

        if (this.allFilteredSelected) {
            filtered.forEach(r => this.selection.deselect(r));
        } else {
            filtered.forEach(r => this.selection.select(r));
        }
        this.refreshSelectHelpers();
    }

    private getFilteredRows(): RedisKeyRow[] {
        const f = (this.dataSource.filter || '').trim().toLowerCase();
        if (!f) {
            return this.dataSource.data;
        }
        return this.dataSource.data.filter(r =>
            r.address.toLowerCase().includes(f) || (r.type || '').toLowerCase().includes(f));
    }

    private refreshSelectHelpers() {
        const filtered = this.getFilteredRows();
        const selectable = filtered.filter(r => this.isRowSelectable(r));
        this.selectableCountFiltered = selectable.length;
        const selectedInFiltered = selectable.filter(r => this.selection.isSelected(r)).length;

        this.allFilteredSelected = selectable.length > 0 && selectedInFiltered === selectable.length;
        this.someFilteredSelected = selectedInFiltered > 0 && !this.allFilteredSelected;
    }

    onOkClick() {
        const selectedNew = this.selection.selected
            .filter(r => this.isRowSelectable(r))
            .map(r => r.address);

        const result: TagPropertyRedisResult = { selectedKeys: selectedNew };
        this.result.emit(result);
        this.dialogRef.close(result);
    }

    onNoClick(): void {
        this.result.emit();
        this.dialogRef.close();
    }

    trackByAddr = (_: number, r: RedisKeyRow) => r.address;
}

export interface RedisKeyRow {
    address: string;
    type: string;
}

export interface TagPropertyRedisScanData {
    device: Device;
    existing?: string[];
}

export interface TagPropertyRedisResult {
    selectedKeys: string[];
}
