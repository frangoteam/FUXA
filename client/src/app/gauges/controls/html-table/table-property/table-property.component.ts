import { Component, EventEmitter, OnInit, Input, Output, ViewChild, OnDestroy } from '@angular/core';
import { Observable, Subject, of, takeUntil } from 'rxjs';
import { UntypedFormControl } from '@angular/forms';
import { MatTabGroup } from '@angular/material/tabs';
import { MatDialog } from '@angular/material/dialog';

import { TranslateService } from '@ngx-translate/core';

import { TableType, TableCellType, TableCellAlignType, TableRangeType, GaugeTableProperty, GaugeEvent, GaugeEventType, GaugeEventActionType } from '../../../../_models/hmi';
import { DataTableComponent } from '../data-table/data-table.component';
import { TableCustomizerComponent, ITableCustom } from '../table-customizer/table-customizer.component';
import { Utils } from '../../../../_helpers/utils';
import { SCRIPT_PARAMS_MAP, Script } from '../../../../_models/script';
import { ProjectService } from '../../../../_services/project.service';

@Component({
    selector: 'app-table-property',
    templateUrl: './table-property.component.html',
    styleUrls: ['./table-property.component.scss']
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

    private destroy$ = new Subject<void>();
    property: GaugeTableProperty;
    eventType = [Utils.getEnumKey(GaugeEventType, GaugeEventType.select)];
    selectActionType = {};
    actionRunScript = Utils.getEnumKey(GaugeEventActionType, GaugeEventActionType.onRunScript);
    scripts$: Observable<Script[]>;

    constructor(private dialog: MatDialog,
                private projectService: ProjectService,
                private translateService: TranslateService) {
        // this.selectActionType[Utils.getEnumKey(GaugeEventActionType, GaugeEventActionType.onwindow)] = this.translateService.instant(GaugeEventActionType.onwindow);
        // this.selectActionType[Utils.getEnumKey(GaugeEventActionType, GaugeEventActionType.ondialog)] = this.translateService.instant(GaugeEventActionType.ondialog);
        this.selectActionType[Utils.getEnumKey(GaugeEventActionType, GaugeEventActionType.onRunScript)] = this.translateService.instant(GaugeEventActionType.onRunScript);
    }

    ngOnInit() {
        Object.keys(this.lastRangeType).forEach(key => {
            this.translateService.get(this.lastRangeType[key]).subscribe((txt: string) => { this.lastRangeType[key] = txt; });
        });
        this._reload();
        this.scripts$ = of(this.projectService.getScripts()).pipe(takeUntil(this.destroy$));
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private _reload() {
        this.property = this.data.settings.property;
        if (this.property) {
            this.tableTypeCtrl.setValue(this.property.type);
            this.options = Object.assign(this.options, DataTableComponent.DefaultOptions(), this.property.options);
        } else {
            this.ngOnInit();
        }
    }

    onTableChanged() {
        this.property.options = JSON.parse(JSON.stringify(this.options));
        this.property.type = this.tableTypeCtrl.value;
        this.onPropChanged.emit(this.data.settings);
    }

    onCustomize() {
        // if (this.grptabs.selectedIndex === 0) { // columns
        //     this.options.columns.push(new TableColumn());
        // } else if (this.grptabs.selectedIndex === 1) { // rows
        //     this.options.rows.push(new TableRow());
        // }

        let dialogRef = this.dialog.open(TableCustomizerComponent, {
            data: <ITableCustom> {
                columns: JSON.parse(JSON.stringify(this.options.columns)),
                rows: JSON.parse(JSON.stringify(this.options.rows)),
                type: <TableType>this.property.type
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

    onAddEvent() {
        const gaugeEvent = new GaugeEvent();
        this.addEvent(gaugeEvent);
    }

    private addEvent(gaugeEvent: GaugeEvent) {
        if (!this.property.events) {
            this.property.events = [];
        }
        this.property.events.push(gaugeEvent);
    }

    onRemoveEvent(index: number) {
        this.property.events.splice(index, 1);
        this.onTableChanged();
    }

    onScriptChanged(scriptId, event) {
        const scripts = this.projectService.getScripts();
        if (event && scripts) {
            let script = scripts.find(s => s.id === scriptId);
            event.actoptions[SCRIPT_PARAMS_MAP] = [];
            if (script && script.parameters) {
                event.actoptions[SCRIPT_PARAMS_MAP] = Utils.clone(script.parameters);
            }
        }
        this.onTableChanged();
    }
}
