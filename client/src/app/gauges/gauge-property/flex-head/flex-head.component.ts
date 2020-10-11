import { Component, OnInit, Input, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormControl } from '@angular/forms';
import { take, takeUntil } from 'rxjs/operators';
import { Subject, ReplaySubject } from 'rxjs';

import { FlexInputComponent } from '../flex-input/flex-input.component';
import { GaugeProperty } from '../../../_models/hmi';
import { Device, Tag } from '../../../_models/device';
import { HmiService } from '../../../_services/hmi.service';
import { Utils } from '../../../_helpers/utils';

interface Variable {
  id: string;
  name: string;
}
@Component({
  selector: 'flex-head',
  templateUrl: './flex-head.component.html',
  styleUrls: ['./flex-head.component.css'],
  encapsulation: ViewEncapsulation.None,
})
export class FlexHeadComponent implements OnInit {

  @Input() data: any;
  @Input() property: GaugeProperty;
  @ViewChild('flexinput') flexInput: FlexInputComponent;

  variable: any;
  withAlarm = false;
  withInput = null;
  alarme: any;
  currentTag: Tag = null;
  defaultValue: any;
  defaultColor = Utils.defaultColor;

  // alarm: string;

  public deviceCtrl: FormControl = new FormControl();
  public deviceFilterCtrl: FormControl = new FormControl();

  public variableCtrl: FormControl = new FormControl();
  public variableFilterCtrl: FormControl = new FormControl();

  public alarmDeviceCtrl: FormControl = new FormControl();
  public alarmDeviceFilterCtrl: FormControl = new FormControl();

  public alarmCtrl: FormControl = new FormControl();
  public alarmFilterCtrl: FormControl = new FormControl();

  /** list of variable filtered by search keyword */
  public filteredDevice: ReplaySubject<Device[]> = new ReplaySubject<Device[]>(1);
  public filteredAlarmDevice: ReplaySubject<Device[]> = new ReplaySubject<Device[]>(1);
  /** list of variable filtered by search keyword */
  public filteredVariable: ReplaySubject<Variable[]> = new ReplaySubject<Variable[]>(1);
  public filteredAlarm: ReplaySubject<Variable[]> = new ReplaySubject<Variable[]>(1);

  /** Subject that emits when the component has been destroyed. */
  private _onDestroy = new Subject<void>();

  constructor() { }

  ngOnInit() {
    if (!this.property) {
      this.property = new GaugeProperty();
    }
    let seldevice = null;
    let selalarmdevice = null;
    if (this.data.devices) {
      if (this.property.variableSrc || this.property.alarmSrc) {
        this.data.devices.forEach(dev => {
          if (this.property.variableSrc && dev.name === this.property.variableSrc) {
            seldevice = dev;
          }
          if (this.property.alarmSrc && dev.name === this.property.alarmSrc) {
            selalarmdevice = dev;
          }
        });
      }
      this.loadDevices();
      this.loadAlarmDevices();
    }
    // if (this.data.variable) {
    //   this.variable = this.data.variable;
    //   this.loadVariable();
    // }
    // set value
    if (seldevice) {
      this.deviceCtrl.setValue(seldevice);
      this.onDeviceChange(this.deviceCtrl);
      if (this.property.variable) {
        for (let i = 0; i < this.variable.length; i++) {
          if (this.variable[i].id === this.property.variable) {
            this.currentTag = this.variable[i];
          }
        }
      }
    }
    if (selalarmdevice) {
      this.withAlarm = true;
      this.alarmDeviceCtrl.setValue(selalarmdevice);
      this.onAlarmDeviceChange(this.alarmDeviceCtrl);
    }

  }

  ngAfterViewInit() {
  }

  ngOnDestroy() {
    this._onDestroy.next();
    this._onDestroy.complete();
  }

  getProperty() {
    if (!this.withAlarm && this.property) {
      this.property.alarmId = '';
      this.property.alarmSrc = '';
      this.property.alarm = '';
      this.property.alarmColor = '';
    }
    if (this.withInput) {
      this.property.ranges = this.flexInput.getRanges();
    }
    return this.property;
  }

  getVariableLabel(vari) {
    if (vari.label) {
      return vari.label;
    } else {
      return vari.name;
    }
  }

  onDeviceChange(event) {
    if (event.value) {
      if (this.property.variableSrc !== event.value.name) {
        this.property.variable = '';
        this.property.variableId = '';
      }
      this.property.variableSrc = event.value.name;
      this.variable = [];
      this.currentTag = null;
      if (event.value.tags) {
        this.variable = Object.values(event.value.tags);
        this.loadVariable(this.property.variable);
      }
    }
  }

  onVariableChange(event) {
    if (event.value) {
      this.property.variable = event.value.name;
      this.property.variableId = HmiService.toVariableId(this.property.variableSrc, this.property.variable);
    }
    this.currentTag = event.value;
    if (this.flexInput) {
      this.flexInput.changeTag(this.currentTag);
    }
  }

  onAlarmDeviceChange(event) {
    if (event.value) {
      if (this.property.alarmSrc !== event.value.name) {
        this.property.alarm = '';
        this.property.alarmId = '';
      }
      this.property.alarmSrc = event.value.name;
      this.alarme = [];
      if (event.value.tags) {
        this.alarme = Object.values(event.value.tags);
        this.loadAlarm(this.property.alarm);
      }
      if (this.property.alarmColor) {

      }
    }
  }

  onAlarmChange(event) {
    if (event.value) {
      this.property.alarm =  (event.value.id) ? event.value.id : event.value.name;
      this.property.alarmId = HmiService.toVariableId(this.property.alarmSrc, this.property.alarm);
    }
  }

  onAlarmColorChange(event) {
    this.property.alarmColor = event.value;
  }

  onAddInput() {
    this.flexInput.onAddInput();
  }
  onRangeViewToggle(slideView) {
    this.flexInput.onRangeViewToggle(slideView);
    this.flexInput.changeTag(this.currentTag);
  }
  onAlarmEnabled(enabled) {
    this.withAlarm = enabled;
  }

  private loadDevices() {
    // load the initial variable list
    this.filteredDevice.next(this.data.devices.slice());
    // listen for search field value changes
    this.deviceFilterCtrl.valueChanges
      .pipe(takeUntil(this._onDestroy))
      .subscribe(() => {
        this.filterDevice();
      });
  }

  private loadAlarmDevices() {
    // load the initial variable list
    this.filteredAlarmDevice.next(this.data.devices.slice());
    // listen for search field value changes
    this.alarmDeviceFilterCtrl.valueChanges
      .pipe(takeUntil(this._onDestroy))
      .subscribe(() => {
        this.filterAlarmDevice();
      });
  }

  private filterDevice() {
    if (!this.data.devices) {
      return;
    }
    // get the search keyword
    let search = this.deviceFilterCtrl.value;
    if (!search) {
      this.filteredDevice.next(this.data.devices.slice());
      return;
    } else {
      search = search.toLowerCase();
    }
    // filter the device
    this.filteredDevice.next(
      this.data.devices.filter(dev => dev.name.toLowerCase().indexOf(search) > -1)
    );
  }

  private filterAlarmDevice() {
    if (!this.data.device) {
      return;
    }
    // get the search keyword
    let search = this.alarmDeviceFilterCtrl.value;
    if (!search) {
      this.filteredAlarmDevice.next(this.data.device.slice());
      return;
    } else {
      search = search.toLowerCase();
    }
    // filter the device
    this.filteredAlarmDevice.next(
      this.data.device.filter(dev => dev.name.toLowerCase().indexOf(search) > -1)
    );
  }

  private loadVariable(toset?: string) {
    // load the initial variable list
    this.filteredVariable.next(this.variable.slice());
    // listen for search field value changes
    this.variableFilterCtrl.valueChanges
      .pipe(takeUntil(this._onDestroy))
      .subscribe(() => {
        this.filterVariable();
      });
    if (toset) {
      let idx = -1;
      this.variable.every(function(value, index, _arr) {
        if (value.id === toset) {
          idx = index;
          return false;
        }
        return true;
      });
      if (idx >= 0) {
        this.variableCtrl.setValue(this.variable[idx]);
      }
    }
  }

  private loadAlarm(toset?: string) {
    // load the initial variable list
    this.filteredAlarm.next(this.alarme.slice());
    // listen for search field value changes
    this.alarmFilterCtrl.valueChanges
      .pipe(takeUntil(this._onDestroy))
      .subscribe(() => {
        this.filterAlarm();
      });
    if (toset) {
      let idx = -1;
      this.alarme.every(function(value, index, _arr) {
        if (value.id === toset) {
          idx = index;
          return false;
        }
        return true;
      });
      if (idx >= 0) {
        this.alarmCtrl.setValue(this.alarme[idx]);
      }
    }
  }

  private filterVariable() {
    if (!this.variable) {
      return;
    }
    // get the search keyword
    let search = this.variableFilterCtrl.value;
    if (!search) {
      this.filteredVariable.next(this.variable.slice());
      return;
    } else {
      search = search.toLowerCase();
    }
    // filter the variable
    this.filteredVariable.next(
      this.variable.filter(vari => vari.name.toLowerCase().indexOf(search) > -1)
    );
  }

  private filterAlarm() {
    if (!this.alarme) {
      return;
    }
    // get the search keyword
    let search = this.alarmFilterCtrl.value;
    if (!search) {
      this.filteredAlarm.next(this.alarme.slice());
      return;
    } else {
      search = search.toLowerCase();
    }
    // filter the variable
    this.filteredAlarm.next(
      this.alarme.filter(vari => vari.name.toLowerCase().indexOf(search) > -1)
    );
  }
}
