import { Component, EventEmitter, OnInit, Input, Output, ViewChild, OnDestroy } from '@angular/core';
import { Observable, Subject, of, takeUntil } from 'rxjs';
import { UntypedFormControl } from '@angular/forms';
import { MatLegacyTabGroup as MatTabGroup } from '@angular/material/legacy-tabs';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';

import { TranslateService } from '@ngx-translate/core';

import { TableType, TableCellType, TableCellAlignType, TableRangeType, GaugeTableProperty, GaugeEvent, GaugeEventType, GaugeEventActionType, TableColumn } from '../../../../_models/hmi';
import { DataTableComponent } from '../data-table/data-table.component';
import { TableCustomizerComponent, TableCustomizerType } from '../table-customizer/table-customizer.component';
import { Utils } from '../../../../_helpers/utils';
import { SCRIPT_PARAMS_MAP, Script } from '../../../../_models/script';
import { ProjectService } from '../../../../_services/project.service';
import { TableAlarmsComponent, TableAlarmsType } from '../table-alarms/table-alarms.component';
import { AlarmColumns, AlarmHistoryColumns } from '../../../../_models/alarm';
import { TableReportsComponent, TableReportsType } from '../table-reports/table-reports.component';
import { ReportColumns } from '../../../../_models/report';

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
        this.destroy$.next(null);
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
        if (this.isAlarmsType()) {
            this.customizeAlarmsTable();
        } else if (this.isReportsType()) {
            this.customizeReportsTable();
        } else {
            this.customizeTable();
        }
    }

    customizeTable() {
        let dialogRef = this.dialog.open(TableCustomizerComponent, {
            data: <TableCustomizerType> {
                columns: JSON.parse(JSON.stringify(this.options.columns)),
                rows: JSON.parse(JSON.stringify(this.options.rows)),
                type: <TableType>this.property.type
            },
            position: { top: '60px' }
        });

        dialogRef.afterClosed().subscribe((result: TableCustomizerType) => {
            if (result) {
                this.options.columns = result.columns;
                this.options.rows = result.rows;
                this.onTableChanged();
            }
        });
    }

    customizeAlarmsTable() {
        let dialogRef = this.dialog.open(TableAlarmsComponent, {
            data: <TableAlarmsType> {
                columns: this.options.alarmsColumns.map(cln => cln.id),
                filter: JSON.parse(JSON.stringify(this.options.alarmFilter)),
                type: <TableType>this.property.type
            },
            position: { top: '60px' }
        });

        dialogRef.afterClosed().subscribe((result: TableAlarmsType) => {
            if (result) {
                let columns = [];
                result.columns.forEach(clnId => {
                    const column = this.options.alarmsColumns.find(cln => cln.id === clnId);
                    if (!column) {
                        columns.push(new TableColumn(clnId, TableCellType.label, this.translateService.instant('alarms.view-' + clnId)));
                    } else {
                        columns.push(column);
                    }
                });
                this.options.alarmsColumns = columns;
                if (this.property.type === TableType.alarms) {
                    this.options.alarmsColumns = this.options.alarmsColumns.sort((a, b) => AlarmColumns.indexOf(a.id) - AlarmColumns.indexOf(b.id));
                } else if (this.property.type === TableType.alarmsHistory) {
                    this.options.alarmsColumns = this.options.alarmsColumns.sort((a, b) => AlarmHistoryColumns.indexOf(a.id) - AlarmHistoryColumns.indexOf(b.id));
                }
                this.options.alarmFilter = result.filter;
                this.onTableChanged();
            }
        });
    }

    customizeReportsTable() {
        let dialogRef = this.dialog.open(TableReportsComponent, {
            data: <TableReportsType> {
                columns: this.options.reportsColumns.map(cln => cln.id),
                filter: JSON.parse(JSON.stringify(this.options.reportFilter)),
                type: <TableType>this.property.type
            },
            position: { top: '60px' }
        });

        dialogRef.afterClosed().subscribe((result: TableReportsType) => {
            if (result) {
                let columns = [];
                result.columns.forEach(clnId => {
                    const column = this.options.reportsColumns.find(cln => cln.id === clnId);
                    if (!column) {
                        columns.push(new TableColumn(clnId, TableCellType.label, this.translateService.instant('table.report-view-' + clnId)));
                    } else {
                        columns.push(column);
                    }
                });
                this.options.reportsColumns = columns.sort((a, b) => ReportColumns.indexOf(a.id) - ReportColumns.indexOf(b.id));
                this.options.reportFilter = result.filter;
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

    getColumns() {
        if (this.isAlarmsType()) {
            return this.options.alarmsColumns;
        } else if (this.isReportsType()) {
            return this.options.reportsColumns;
        } else {
            return this.options.columns;
        }
    }
    isAlarmsType() {
        return this.property.type === TableType.alarms || this.property.type === TableType.alarmsHistory;
    }

    isReportsType() {
        return this.property.type === TableType.reports;
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
