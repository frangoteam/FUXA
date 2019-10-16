import { Component, Inject, ViewContainerRef, OnInit, AfterViewInit, ViewChild, Input } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

import { FlexHeadComponent } from './flex-head/flex-head.component';
import { FlexEventComponent } from './flex-event/flex-event.component';
import { GaugeProperty, View } from '../../_models/hmi';

@Component({
  selector: 'gauge-property',
  templateUrl: './gauge-property.component.html',
  styleUrls: ['./gauge-property.component.css']
})
export class GaugePropertyComponent implements OnInit {

  @Input() name: any;
  @ViewChild('flexhead') flexHead: FlexHeadComponent;
  @ViewChild('flexevent') flexEvent: FlexEventComponent;

  withAlarm = false;
  slideView = true;
  property: GaugeProperty;
  dialogType: GaugeDialogType = GaugeDialogType.RangeWithAlarm;
  eventsSupported: boolean;
  views: View[];
  defaultValue: any;

  constructor(
    public dialogRef: MatDialogRef<GaugePropertyComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any) { }

  ngOnInit() {
    this.dialogType = this.data.dlgType;
    this.eventsSupported = this.data.withEvents;
    this.views = this.data.views;
    this.property = JSON.parse(JSON.stringify(this.data.settings.property));
    this.defaultValue = this.data.default;

    if (this.dialogType === GaugeDialogType.OnlyValue) {
      this.flexHead.withInput = null;      
    } else if (this.dialogType === GaugeDialogType.ValueAndUnit) {
      this.flexHead.withInput = 'unit';
    } else {
      this.flexHead.defaultValue = this.defaultValue;
      if (this.property && this.property.alarmSrc) {
        this.withAlarm = true;
      }
      this.flexHead.withInput = 'range';
      if (this.dialogType === GaugeDialogType.ValueWithRef) {
        this.flexHead.withInput = 'text';
        this.withAlarm = false;
      } else if (this.dialogType === GaugeDialogType.Step) {
        this.flexHead.withInput = 'step';
        this.withAlarm = false;
      } else if (this.dialogType === GaugeDialogType.MinMax) {
        this.flexHead.withInput = 'minmax';
        this.withAlarm = false;
      }
    }
  }

  onNoClick(): void {
    this.dialogRef.close();
  }

  onOkClick(): void {
    // this.data.settings.property = this.flexHead.property;
    this.data.settings.property = this.flexHead.getProperty();
    if (this.flexEvent) {
      this.data.settings.property.events = this.flexEvent.getEvents();
    }
  }

  onAddInput() {
    this.flexHead.onAddInput();
  }
  onAddEvent() {
    this.flexEvent.onAddEvent();
  }
  onRangeViewToggle() {
    this.flexHead.onRangeViewToggle(this.slideView);
  }
  onAlarmToggle() {
    this.flexHead.onAlarmEnabled(this.withAlarm);
  }

  isToolboxToShow() {
    if (this.dialogType === GaugeDialogType.RangeWithAlarm || this.dialogType === GaugeDialogType.Range || this.dialogType === GaugeDialogType.Step) {
      return true;
    }
    return false;
  }

  isRangeToShow() {
    if (this.dialogType === GaugeDialogType.RangeWithAlarm || this.dialogType === GaugeDialogType.Range) {
      return true;
    }
    return false;
  }

  isAlarmToShow() {
    if (this.dialogType === GaugeDialogType.RangeWithAlarm) {
      return true;
    }
    return false;
  }
}

export enum GaugeDialogType {
  Range,
  RangeWithAlarm,
  OnlyValue,
  ValueAndUnit,
  ValueWithRef,
  Step,
  MinMax,
  Chart
}