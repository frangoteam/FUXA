import { Component, Inject, OnInit, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { ReplaySubject } from 'rxjs';
import { FormControl } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

import { TranslateService } from '@ngx-translate/core';

import { GaugeChartProperty } from '../../../../_models/hmi';
import { Chart, ChartViewType, ChartLegendMode } from '../../../../_models/chart';
import { DygraphOptions } from '../../../../gui-helpers/ngx-dygraphs/dygraphOptions';
import { Define } from '../../../../_helpers/define';
import { Utils } from '../../../../_helpers/utils';

declare const Dygraph: any;

@Component({
    selector: 'app-chart-property',
    templateUrl: './chart-property.component.html',
    styleUrls: ['./chart-property.component.css']
})
export class ChartPropertyComponent implements OnInit, AfterViewInit {

    chartViewType = ChartViewType;
    legendModes = ChartLegendMode;
    fonts = Define.fonts;
    defaultColor = Utils.defaultColor;
    chartViewValue: any;
    public chartCtrl: FormControl = new FormControl();
    public chartFilterCtrl: FormControl = new FormControl();

    @ViewChild('chart') public chart: ElementRef;
    public dygraph: any;
    public defOptions: DygraphOptions = {
        // width: "auto",
        // height: "auto",
        labels: ['Date', 'Temperature'],
        colors: ['#f70808'],
        // xlabel: "X label text",
        // ylabel: "Y label text",
        title: 'My Title',
        animatedZooms: true,
        connectSeparatedPoints: true,
        labelsSeparateLines: true,
        // pointSize: 2,
    };
    options: DygraphOptions = { fontFamily: 'Roboto-Regular', legendFontSize: 10, colorBackground: 'rgba(0,0,0,0)', legendBackground: 'rgba(0,0,0,0)', 
                        titleHeight: 20, axisLabelFontSize: 12, labelsDivWidth: 0, axisLineColor: 'rgba(0,0,0,1)', axisLabelColor: 'rgba(0,0,0,1)',
                        legend: 'always'};

    autoScala = { enabled: true, min: 0, max: 10 };

    public sampleData = [[new Date('1967/09/14'), 0], [new Date('1968/09/14'), 3], [new Date('1969/09/14'), 1], [new Date('1970/09/14'), 2]];

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
        this.syncOptions(this.options);
        if (selected) {
            this.chartCtrl.setValue(selected);
        }
    }

    ngAfterViewInit() {
        this.dygraph = new Dygraph(this.chart.nativeElement, this.sampleData, this.defOptions);
        this.dygraph.ready(graph => {
            this.dygraph.resize(600, 280);
        });
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
        } else if (option === 'legend') {
            this.options.legend = value;
        } else if (option === 'axisLabelColor') {
            this.options.axisLineColor = value;
            this.options.axisLabelColor = value;
            this.changeTitleColor(value);
        } else if (option === 'fontFamily') {
            this.options.fontFamily = value;
            this.changeFontFamily(value);
            return;
        } else if (option === 'legendFontSize') {
            this.options.legendFontSize = value;
            this.changeLegendFontSize(value);
            return;
        } else if (option === 'colorBackground') {
            this.options.colorBackground = value;
            this.changeBackgroundColor(value);
            return;
        } else if (option === 'legendBackground') {
            this.options.legendBackground = value;
            this.changeLegendBackgroundColor(value);
            return;
        }
        this.syncOptions(this.options);
        this.dygraph.updateOptions(this.defOptions);
    }

    onTabChanged() {
        this.changeFontFamily(this.options.fontFamily);
        this.changeLegendFontSize(this.options.legendFontSize);
        this.changeBackgroundColor(this.options.colorBackground);
        this.changeLegendBackgroundColor(this.options.legendBackground);
        this.changeTitleColor(this.options.axisLabelColor);
    }

    private changeFontFamily(font) {
        if (font) {
            this.chart.nativeElement.style.fontFamily = font;
        }
    }

    private changeLegendFontSize(size) {
        let  ele = this.chart.nativeElement.getElementsByClassName('dygraph-legend');
        if (ele && ele.length) {
            ele[0].style.fontSize = size + 'px';
        }
    }

    private changeLegendBackgroundColor(color) {
        let  ele = this.chart.nativeElement.getElementsByClassName('dygraph-legend');
        if (ele && ele.length) {
            ele[0].style.backgroundColor = color;
        }
    }

    private changeBackgroundColor(color) {
        if (color) {
            this.chart.nativeElement.style.backgroundColor = color;
        }
    }

    private changeTitleColor(color) {
        this.chart.nativeElement.style.color =  color;
    }

    private syncOptions(options) {
        this.defOptions = Object.assign(this.defOptions, options);
        delete this.defOptions['fontFamily'];
        delete this.defOptions['legendFontSize'];
        delete this.defOptions['colorBackground'];
        delete this.defOptions['legendBackground'];
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
