import { Component, EventEmitter, OnInit, Input, Output, ViewChild, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { UntypedFormControl } from '@angular/forms';
import { MatTabGroup } from '@angular/material/tabs';
import { MatDialog } from '@angular/material/dialog';

import { TranslateService } from '@ngx-translate/core';

import { TableType, TableCellType, TableCellAlignType, TableRangeType } from '../../../../_models/hmi';
import { DataTableComponent } from '../data-table/data-table.component';
import { TableCustomizerComponent, ITableCustom } from '../table-customizer/table-customizer.component';
import { Utils } from '../../../../_helpers/utils';

@Component({
    selector: 'app-table-property',
    templateUrl: './table-property.component.html',
    styleUrls: ['./table-property.component.css']
})
export class TablePropertyComponent implements OnInit, OnDestroy {

    @Input() data: any;
    @Output() onPropChanged: EventEmitter<any> = new EventEmitter();
    @Input('reload') set reload(b: any) {
        this._reload();
    }
    @ViewChild('grptabs', {static: false}) grptabs: MatTabGroup;

    tableTypeCtrl: UntypedFormControl = new UntypedFormControl();
    options = DataTableComponent.DefaultOptions();
    tableType = TableType;
    columnType = TableCellType;
    alignType = TableCellAlignType;
    lastRangeType = TableRangeType;
    defaultColor = Utils.defaultColor;

    private _onDestroy = new Subject<void>();

    constructor(
        private dialog: MatDialog,
        private translateService: TranslateService) {
        }

    ngOnInit() {
        Object.keys(this.lastRangeType).forEach(key => {
            this.translateService.get(this.lastRangeType[key]).subscribe((txt: string) => { this.lastRangeType[key] = txt; });
        });
        this._reload();
    }

    ngOnDestroy() {
        this._onDestroy.next();
        this._onDestroy.complete();
    }

    private _reload() {
        if (this.data.settings.property) {
            this.tableTypeCtrl.setValue(this.data.settings.property.type);
            Object.assign(this.options, DataTableComponent.DefaultOptions(), this.data.settings.property.options);
        } else {
            this.ngOnInit();
        }
    }

    onTableChanged() {
        this.data.settings.property.options = JSON.parse(JSON.stringify(this.options));
        this.data.settings.property.type = this.tableTypeCtrl.value;
        this.onPropChanged.emit(this.data.settings);
    }

    onAdd() {
        // if (this.grptabs.selectedIndex === 0) { // columns
        //     this.options.columns.push(new TableColumn());
        // } else if (this.grptabs.selectedIndex === 1) { // rows
        //     this.options.rows.push(new TableRow());
        // }

        let dialogRef = this.dialog.open(TableCustomizerComponent, {
            data: <ITableCustom> {
                columns: JSON.parse(JSON.stringify(this.options.columns)),
                rows: JSON.parse(JSON.stringify(this.options.rows)),
                type: <TableType>this.data.settings.property.type
            },
            position: { top: '60px' }
        });

        dialogRef.afterClosed().subscribe((result: ITableCustom) => {
            if (result) {
                this.options.columns = result.columns;
                this.options.rows = result.rows;
                this.onTableChanged();
            }
        });
    }
}
