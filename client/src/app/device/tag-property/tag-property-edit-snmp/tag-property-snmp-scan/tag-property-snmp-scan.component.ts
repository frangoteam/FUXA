import { Component, EventEmitter, Inject, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { Subject, filter, takeUntil } from 'rxjs';
import { MatDialogRef as MatDialogRef, MAT_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator as MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { SelectionModel } from '@angular/cdk/collections';
import { HmiService } from '../../../../_services/hmi.service';
import { Device } from '../../../../_models/device';

@Component({
    selector: 'app-tag-property-snmp-scan',
    templateUrl: './tag-property-snmp-scan.component.html',
    styleUrls: ['./tag-property-snmp-scan.component.scss']
})
export class TagPropertySnmpScanComponent implements OnInit, OnDestroy {
    @Output() result = new EventEmitter<TagPropertySnmpScanResult>();
    private destroy$ = new Subject<void>();

    displayedColumns = ['select', 'address', 'name', 'type', 'value'];
    dataSource = new MatTableDataSource<SnmpOidRow>([]);
    selection = new SelectionModel<SnmpOidRow>(true, []);

    loading = false;
    error = '';
    truncated = false;
    baseOid = '1.3.6.1.2.1';
    max = 2000;

    existingOids = new Set<string>();

    /** header checkbox helpers (consider ONLY the selectable rows) */
    selectableCountFiltered = 0;
    allFilteredSelected = false;
    someFilteredSelected = false;

    @ViewChild(MatPaginator, { static: true }) paginator!: MatPaginator;
    @ViewChild(MatSort, { static: true }) sort!: MatSort;

    constructor(
        private hmiService: HmiService,
        private dialogRef: MatDialogRef<TagPropertySnmpScanComponent>,
        @Inject(MAT_DIALOG_DATA) public data: TagPropertySnmpScanData
    ) { }

    ngOnInit() {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;

        this.dataSource.filterPredicate = (row, filterValue) => {
            const f = (filterValue || '').trim().toLowerCase();
            if (!f) {
                return true;
            }
            return this.rowMatches(row, f);
        };

        if (Array.isArray(this.data?.existing)) {
            for (const oid of this.data.existing) {
                this.existingOids.add(oid);
            }
        }

        // result browse (one-shot)
        this.hmiService.onDeviceBrowse
            .pipe(takeUntil(this.destroy$), filter(res => !!res && res.device === this.data.device.id))
            .subscribe((res: any) => {
                this.error = res?.error ? String(res.error) : '';
                this.truncated = !!res?.result?.truncated;
                const items: SnmpOidRow[] = (res?.result?.items || []).map((x: any) => ({
                    address: x.address,
                    name: x.name || '',
                    type: x.type || 'Integer',
                    value: (x.value === null || x.value === undefined) ? '' : String(x.value)
                }));
                this.dataSource.data = items;

                // PRE-SELECT existing ones (checkbox true, but not toggleable)
                const preselected = items.filter(r => this.existingOids.has(r.address));
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
        this.error = '';
        this.truncated = false;

        const node = {
            oid: (this.baseOid || '').trim(),
            max: this.max
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

    isRowSelectable(row: SnmpOidRow) {
        return !this.existingOids.has(row.address);
    }

    toggleRow(row: SnmpOidRow) {
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

    private rowMatches(row: SnmpOidRow, f: string) {
        return row.address.toLowerCase().includes(f) || (row.name || '').toLowerCase().includes(f) ||
            (row.type || '').toLowerCase().includes(f) || (row.value || '').toLowerCase().includes(f);
    }

    private getFilteredRows(): SnmpOidRow[] {
        const f = (this.dataSource.filter || '').trim().toLowerCase();
        if (!f) {
            return this.dataSource.data;
        }
        return this.dataSource.data.filter(r => this.rowMatches(r, f));
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
        const selected = this.selection.selected.filter(r => this.isRowSelectable(r));
        const result: TagPropertySnmpScanResult = { selected: selected };
        this.result.emit(result);
        this.dialogRef.close(result);
    }

    onNoClick(): void {
        this.result.emit();
        this.dialogRef.close();
    }

    trackByAddr = (_: number, r: SnmpOidRow) => r.address;
}

export interface SnmpOidRow {
    address: string;
    /** MIB name 'MODULE::name.instance' if known by the server */
    name: string;
    type: string;
    value: string;
}

export interface TagPropertySnmpScanData {
    device: Device;
    existing?: string[];
}

export interface TagPropertySnmpScanResult {
    selected: SnmpOidRow[];
}
