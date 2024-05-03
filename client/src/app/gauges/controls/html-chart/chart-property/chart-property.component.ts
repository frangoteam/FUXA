import { Component, OnInit, Input, Output, EventEmitter, OnDestroy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ReplaySubject } from 'rxjs';
import { UntypedFormControl } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

import { TranslateService } from '@ngx-translate/core';

import { GaugeChartProperty, DateFormatType, TimeFormatType } from '../../../../_models/hmi';
import { Chart, ChartViewType, ChartLegendMode, ChartRangeType } from '../../../../_models/chart';
import { ChartUplotComponent } from '../chart-uplot/chart-uplot.component';
import { ChartConfigComponent, IDataChartResult } from '../../../../editor/chart-config/chart-config.component';
import { Define } from '../../../../_helpers/define';
import { Utils } from '../../../../_helpers/utils';
import { ChartOptions } from '../../../../gui-helpers/ngx-uplot/ngx-uplot.component';
import { ProjectService } from '../../../../_services/project.service';
import { Script } from '../../../../_models/script';
import { MatSelectChange } from '@angular/material/select';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../gui-helpers/confirm-dialog/confirm-dialog.component';


@Component({
    selector: 'app-chart-property',
    templateUrl: './chart-property.component.html',
    styleUrls: ['./chart-property.component.scss']
})
export class ChartPropertyComponent implements OnInit, OnDestroy {

    @Input() data: any;
    @Output() onPropChanged: EventEmitter<any> = new EventEmitter();
    @Input('reload') set reload(b: any) {
        this._reload();
    }

    lastRangeType = ChartRangeType;
    chartViewType = ChartViewType;

    dateFormat = DateFormatType;
    timeFormat = TimeFormatType;
    legendModes = ChartLegendMode;
    fonts = Define.fonts;
    defaultColor = Utils.defaultColor;
    chartViewValue = ChartViewType.realtime1;
    public chartCtrl: UntypedFormControl = new UntypedFormControl();
    public chartFilterCtrl: UntypedFormControl = new UntypedFormControl();
    public filteredChart: ReplaySubject<Chart[]> = new ReplaySubject<Chart[]>(1);
    options: ChartOptions = ChartUplotComponent.DefaultOptions();
    autoScala = { enabled: true, min: 0, max: 10 };
    scripts: Script[];

    private _onDestroy = new Subject<void>();

    constructor(
        public dialog: MatDialog,
        public projectService: ProjectService,
        private translateService: TranslateService) { }

    ngOnInit() {
        Object.keys(this.legendModes).forEach(key => {
            this.translateService.get(this.legendModes[key]).subscribe((txt: string) => { this.legendModes[key] = txt; });
        });
        this.scripts = this.projectService.getScripts();
    }

    ngOnDestroy() {
        this._onDestroy.next();
        this._onDestroy.complete();
    }

    private _reload() {
        // check default value, undefined if new
        if (!this.data.settings.property) {
            this.data.settings.property = <GaugeChartProperty>{ id: null, type: this.chartViewValue, options: null };
        }
        if (!this.data.settings.property.options) {
            this.data.settings.property.options = ChartUplotComponent.DefaultOptions();
        }
        this.options = this.data.settings.property.options;
        // // load charts list to choise
        this.loadChart();
        let chart = null;
        if (this.data.settings.property) {
            this.chartViewValue = this.data.settings.property.type;
            chart = this.data.charts.find(chart => chart.id === this.data.settings.property.id);
            if (this.data.settings.property.options) {
                this.options = Object.assign(this.options, this.data.settings.property.options);
            }
        } else {
            this.data.settings.property = <GaugeChartProperty>{ id: null, type: this.chartViewValue, options: JSON.parse(JSON.stringify(this.options)) };
        }
        this.chartCtrl.setValue(chart);
    }

    onChartChanged() {
        this.data.settings.property = <GaugeChartProperty>{ id: null, type: this.chartViewValue, options: JSON.parse(JSON.stringify(this.options)) };
        if (this.chartCtrl.value) {
            this.data.settings.property.id = this.chartCtrl.value.id;
        }
        this.onPropChanged.emit(this.data.settings);
    }

    onEditNewChart() {
        let dialogRef = this.dialog.open(ChartConfigComponent, {
            position: { top: '60px' },
            minWidth: '1090px', width: '1090px'
        });
        dialogRef.afterClosed().subscribe((result: IDataChartResult) => {
            if (result) {
                this.data.charts = result.charts;
                this.loadChart();
                if (result.selected) {
                    this.chartCtrl.setValue(result.selected);
                }
                this.onChartChanged();
            }
        });
    }

    onShowChartSelectionMessage(event: MatSelectChange) {
        if (event.value === ChartViewType.custom) {
            let dialogRef = this.dialog.open(ConfirmDialogComponent, {
                data: <ConfirmDialogData> {
                    msg: this.translateService.instant('msg.chart-with-script'),
                    hideCancel: true
                },
                position: { top: '60px' }
            });
            dialogRef.afterClosed().subscribe();
        }
    }

    private loadChart(toset?: string) {
        // load the initial chart list
        this.filteredChart.next(this.data.charts.slice());
        // listen for search field value changes
        this.chartFilterCtrl.valueChanges
            .pipe(takeUntil(this._onDestroy))
            .subscribe(() => {
                this.filterChart();
            });
        if (toset) {
            let idx = -1;
            this.data.charts.every(function(value, index, _arr) {
                if (value.id === toset) {
                    idx = index;
                    return false;
                }
                return true;
            });
            if (idx >= 0) {
                this.chartCtrl.setValue(this.data.charts[idx]);
            }
        }
    }

    private filterChart() {
        if (!this.data.charts) {
            return;
        }
        // get the search keyword
        let search = this.chartFilterCtrl.value;
        if (!search) {
            this.filteredChart.next(this.data.charts.slice());
            return;
        } else {
            search = search.toLowerCase();
        }
        // filter the variable
        this.filteredChart.next(
            this.data.charts.filter(chart => chart.name.toLowerCase().indexOf(search) > -1)
        );
    }
}
