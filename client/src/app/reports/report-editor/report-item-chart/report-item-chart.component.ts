import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { ReplaySubject, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ReportDateRangeType, ReportItemChart } from '../../../_models/report';
import { ProjectService } from '../../../_services/project.service';
import { Chart } from '../../../_models/chart';

@Component({
    selector: 'app-report-item-chart',
    templateUrl: './report-item-chart.component.html',
    styleUrls: ['./report-item-chart.component.scss']
})
export class ReportItemChartComponent implements OnInit, OnDestroy {

    public chartCtrl: UntypedFormControl = new UntypedFormControl();
    public chartFilterCtrl: UntypedFormControl = new UntypedFormControl();
    public filteredChart: ReplaySubject<Chart[]> = new ReplaySubject<Chart[]>(1);

    dateRangeType = ReportDateRangeType;
    private charts: Chart[];

    private _onDestroy = new Subject<void>();

    constructor(
        public dialogRef: MatDialogRef<ReportItemChartComponent>,
        private translateService: TranslateService,
        private projectService: ProjectService,
        @Inject(MAT_DIALOG_DATA) public data: ReportItemChart) {
            this.charts = this.projectService.getCharts();
        }

    ngOnInit() {
        Object.keys(this.dateRangeType).forEach(key => {
            this.translateService.get(this.dateRangeType[key]).subscribe((txt: string) => { this.dateRangeType[key] = txt; });
        });

        this.loadChart();
        let chart = null;
        if (this.data.chart) {
            chart = this.charts.find(chart => chart.id === this.data.chart.id);
        }
        this.chartCtrl.setValue(chart);
    }

    ngOnDestroy() {
        this._onDestroy.next();
        this._onDestroy.complete();
    }

    onChartChanged() {
        // this.data.settings.property = <GaugeChartProperty>{ id: null, type: this.chartViewValue, options: JSON.parse(JSON.stringify(this.options)) };
        // if (this.chartCtrl.value) {
        //     this.data.settings.name = this.chartCtrl.value.name;
        //     this.data.settings.property.id = this.chartCtrl.value.id;
        // } else {
        //     this.data.settings.name = '';
        // }
        // this.onPropChanged.emit(this.data.settings);
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.data.chart = this.chartCtrl.value;
        this.dialogRef.close(this.data);
    }

    private loadChart(toset?: string) {
        // load the initial chart list
        this.filteredChart.next(this.charts.slice());
        // listen for search field value changes
        this.chartFilterCtrl.valueChanges
            .pipe(takeUntil(this._onDestroy))
            .subscribe(() => {
                this.filterChart();
            });
        if (toset) {
            let idx = -1;
            this.charts.every(function(value, index, _arr) {
                if (value.id === toset) {
                    idx = index;
                    return false;
                }
                return true;
            });
            if (idx >= 0) {
                this.chartCtrl.setValue(this.charts[idx]);
            }
        }
    }

    private filterChart() {
        if (!this.charts) {
            return;
        }
        // get the search keyword
        let search = this.chartFilterCtrl.value;
        if (!search) {
            this.filteredChart.next(this.charts.slice());
            return;
        } else {
            search = search.toLowerCase();
        }
        // filter the variable
        this.filteredChart.next(
            this.charts.filter(chart => chart.name.toLowerCase().indexOf(search) > -1)
        );
    }
}
