import { Component, Inject, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { ReplaySubject } from 'rxjs/ReplaySubject';
import { FormControl } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs/Subject';

import { TranslateService } from '@ngx-translate/core';

import { Chart, ChartViewType } from '../../_models/chart';

@Component({
  selector: 'app-chart-property',
  templateUrl: './chart-property.component.html',
  styleUrls: ['./chart-property.component.css']
})
export class ChartPropertyComponent implements OnInit {

  chartViewType = ChartViewType;
  chartViewValue: any;
  public chartCtrl: FormControl = new FormControl();
  public chartFilterCtrl: FormControl = new FormControl();

  public filteredChart: ReplaySubject<Chart[]> = new ReplaySubject<Chart[]>(1);

  private _onDestroy = new Subject<void>();

  constructor(
    public dialogRef: MatDialogRef<ChartPropertyComponent>,
    private translateService: TranslateService,
    @Inject(MAT_DIALOG_DATA) public data: any) { }

  ngOnInit() {
    Object.keys(this.chartViewType).forEach(key => {
      this.translateService.get(this.chartViewType[key]).subscribe((txt: string) => {this.chartViewType[key] = txt});
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
    }
    if (selected) {
      this.chartCtrl.setValue(selected);
    }
  }

  
  ngOnDestroy() {
    this._onDestroy.next();
    this._onDestroy.complete();
  }

  onNoClick(): void {
    this.dialogRef.close();
  }

  onOkClick(): void {
    if (this.chartCtrl.value) {
      this.data.settings.property = { id: this.chartCtrl.value.id, type: this.chartViewValue };
      this.data.settings.name = this.chartCtrl.value.name;
    } else {
      this.data.settings.name = '';
      this.data.settings.property = null;
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
