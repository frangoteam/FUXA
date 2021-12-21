import { Component, Inject, OnInit, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { ReplaySubject } from 'rxjs';
import { FormControl } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

import { TranslateService } from '@ngx-translate/core';

import { GaugeChartProperty, DateFormatType, TimeFormatType } from '../../../../_models/hmi';
import { Chart, ChartViewType, ChartLegendMode } from '../../../../_models/chart';
import { ChartOptions, ChartUplotComponent } from '../chart-uplot/chart-uplot.component';
import { Define } from '../../../../_helpers/define';
import { Utils } from '../../../../_helpers/utils';


@Component({
    selector: 'app-chart-property',
    templateUrl: './chart-property.component.html',
    styleUrls: ['./chart-property.component.css']
})
export class ChartPropertyComponent implements OnInit, AfterViewInit {

    chartViewType = ChartViewType;
    chartViewRealtime = Utils.getEnumKey(ChartViewType, ChartViewType.realtime1);
    dateFormat = DateFormatType;
    timeFormat = TimeFormatType;
    legendModes = ChartLegendMode;
    fonts = Define.fonts;
    defaultColor = Utils.defaultColor;
    chartViewValue: any;
    public chartCtrl: FormControl = new FormControl();
    public chartFilterCtrl: FormControl = new FormControl();

    @ViewChild('chartuplot') public chartuplot: ChartUplotComponent;

    options: ChartOptions = ChartUplotComponent.DefaultOptions();

    autoScala = { enabled: true, min: 0, max: 10 };

    public filteredChart: ReplaySubject<Chart[]> = new ReplaySubject<Chart[]>(1);

    private _onDestroy = new Subject<void>();

    constructor(
        public dialogRef: MatDialogRef<ChartPropertyComponent>,
        private translateService: TranslateService,
        @Inject(MAT_DIALOG_DATA) public data: any) { }

    ngOnInit() {
        Object.keys(this.chartViewType).forEach(key => {
            this.translateService.get(this.chartViewType[key]).subscribe((txt: string) => { this.chartViewType[key] = txt });
        });
        Object.keys(this.legendModes).forEach(key => {
            this.translateService.get(this.legendModes[key]).subscribe((txt: string) => { this.legendModes[key] = txt });
        });
        this.loadChart();
        let selected = null;
        if (this.data.settings.property) {
            this.chartViewValue = this.data.settings.property.type;
            this.data.charts.forEach(chart => {
                if (chart.id === this.data.settings.property.id) {
                    selected = chart;
                }
            });
            if (this.data.settings.property.options) {
                this.options = Object.assign(this.options, this.data.settings.property.options);
            }
        }
        if (selected) {
            this.chartCtrl.setValue(selected);
        }
    }

    ngAfterViewInit() {
        this.chartuplot.isEditor = true;
        this.chartuplot.withToolbar = false;
        this.chartuplot.setOptions(this.options);
    }

    ngOnDestroy() {
        this._onDestroy.next();
        this._onDestroy.complete();
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.data.settings.property = <GaugeChartProperty>{ id: null, type: this.chartViewValue, options: this.options };
        if (this.chartCtrl.value) {
            this.data.settings.name = this.chartCtrl.value.name;
            this.data.settings.property.id = this.chartCtrl.value.id;
        } else {
            this.data.settings.name = '';
        }
    }

    onChangeOptions(option, value) {
        if (option === 'titleHeight') {
            this.options.titleHeight = value;
        } else if (option === 'axisLabelFontSize') {
            this.options.axisLabelFontSize = value;
        } else if (option === 'axisLabelColor') {
            this.options.axisLineColor = value;
            this.options.axisLabelColor = value;
        } else if (option === 'fontFamily') {
            this.options.fontFamily = value;
        } else if (option === 'colorBackground') {
            this.options.colorBackground = value;
        } else if (option === 'gridLineColor') {
            this.options.gridLineColor = value;
        } else if (option === 'legend') {
            this.options.legendMode = value;
        } else if (option === 'date') {
            this.options.dateFormat = value;
        } else if (option === 'time') {
            this.options.timeFormat = value;
        } else if (option === 'axisLabel') {
        }
        this.chartuplot.setOptions(this.options);
    }

    onTabChanged() {
        this.chartuplot.withToolbar = (this.chartViewValue !== this.chartViewRealtime);
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
            this.data.charts.every(function (value, index, _arr) {
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
