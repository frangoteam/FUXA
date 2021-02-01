import {Component, EventEmitter, Input, OnInit, Output, SimpleChanges} from '@angular/core';
import {ReplaySubject, Subject} from 'rxjs';
import {FormControl} from '@angular/forms';
import {takeUntil} from 'rxjs/operators';

import {Device} from '../../../_models/device';
import {HmiService} from '../../../_services/hmi.service';

interface Variable {
  id: string;
  name: string;
}

export const USER_DEFINED_VARIABLE = 'user-defined';

@Component({
  selector: 'flex-variable',
  templateUrl: './flex-variable.component.html',
  styleUrls: ['./flex-variable.component.css']
})
export class FlexVariableComponent implements OnInit {
  @Input() data: any;
  // Legacy
  @Input() variableSrc: string;
  @Input() variableId: string;
  @Input() variable: string;

  @Input() value: any;

  @Input() allowManualEdit: boolean = false;
  @Output() onchange: EventEmitter<any> = new EventEmitter();
  @Output() valueChange: EventEmitter<any> = new EventEmitter();

  public manualEdit: boolean = false;

  variableList: any = [];
  currentVariable: Variable = null;
  public deviceCtrl: FormControl = new FormControl();
  public deviceFilterCtrl: FormControl = new FormControl();
  public variableCtrl: FormControl = new FormControl();
  public variableFilterCtrl: FormControl = new FormControl();
  /** list of variable filtered by search keyword */
  public filteredDevice: ReplaySubject<Device[]> = new ReplaySubject<Device[]>(1);
  /** list of variable filtered by search keyword */
  public filteredVariable: ReplaySubject<Variable[]> = new ReplaySubject<Variable[]>(1);

  /** Subject that emits when the component has been destroyed. */
  private _onDestroy = new Subject<void>();

  constructor() {
  }

  ngOnInit() {
    this.initInput();

    if (this.allowManualEdit && this.value.variableSrc == USER_DEFINED_VARIABLE) {
      this.manualEdit = true;
    }

    let selDevice = null;
    if (this.data.devices) {
      if (this.value.variableSrc) {
        this.data.devices.forEach(dev => {
          if (this.value.variableSrc && dev.name === this.value.variableSrc) {
            selDevice = dev;
          }
        });
      }
      this.loadDevices();
    }
    // set value
    if (selDevice) {
      this.deviceCtrl.setValue(selDevice);
      this.setDevise(this.deviceCtrl);
      if (this.variableList) {
        for (let i = 0; i < this.variableList.length; i++) {
          if (this.variableList[i].id === this.variable) {
            this.currentVariable = this.variableList[i];
          }
        }
      }
    }
  }

  ngOnChanges(changes: SimpleChanges) {
  }

  initInput() {
    if (!this.value) {
      this.value = {
        variableId: this.variableId,
        variableSrc: this.variableSrc,
        variable: this.variable
      }
    }

    if (this.value.variableId) {
      let variableParts = HmiService.fromVariableId(this.value.variableId);
      if (!this.value.variableSrc) {
        this.value.variableSrc = variableParts[0]
      }
      if (!this.value.variable) {
        this.value.variable = variableParts[1]
      }
    }

    if (typeof this.value.variable == 'undefined') {
      this.value.variable = '';
    }
  }

  getVariableLabel(vari) {
    return vari.label || vari.name;
  }

  toggleView(event) {
    event.stopPropagation();
    this.manualEdit = !this.manualEdit;
    if (this.manualEdit) {
      this.value.variableSrc = USER_DEFINED_VARIABLE;
    } else {
      this.value.variableSrc = this.deviceCtrl.value ? this.deviceCtrl.value.name : '';
      this.value.variable = this.variableCtrl.value ? this.variableCtrl.value.name : '';
    }
    this.onChanged();
  }

  setDevise(event) {
    if (event.value) {
      if (this.value.variableSrc !== event.value.name) {
        this.value.variableSrc = '';
      }
      this.value.variableSrc = event.value.name;
      this.variableList = [];
      this.currentVariable = null;
      if (event.value.tags) {
        this.variableList = Object.values(event.value.tags);
        this.loadVariable(this.value.variable);
      }
    }
  }

  onDeviceChange(event) {
    this.setDevise(event);
    this.onChanged();
  }

  onVariableChange(event) {
    if (event.value) {
      this.value.variable = event.value.name;
    }
    this.currentVariable = event.value;
    this.onChanged();
  }

  onChanged() {
    this.value.variableId = HmiService.toVariableId(this.value.variableSrc, this.value.variable);
    this.value.variableRaw = this.currentVariable;
    this.onchange.emit(this.value)   // Legacy
    this.valueChange.emit(this.value)
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

  private loadVariable(toset?: string) {
    // load the initial variable list
    this.filteredVariable.next(this.variableList.slice());
    // listen for search field value changes
    this.variableFilterCtrl.valueChanges
      .pipe(takeUntil(this._onDestroy))
      .subscribe(() => {
        this.filterVariable();
      });
    if (toset) {
      let idx = -1;
      this.variableList.every(function (value, index, _arr) {
        if (value.id === toset) {
          idx = index;
          return false;
        }
        return true;
      });
      if (idx >= 0) {
        this.variableCtrl.setValue(this.variableList[idx]);
      }
    }
  }

  private filterVariable() {
    if (!this.variableList) {
      return;
    }
    // get the search keyword
    let search = this.variableFilterCtrl.value;
    if (!search) {
      this.filteredVariable.next(this.variableList.slice());
      return;
    } else {
      search = search.toLowerCase();
    }
    // filter the variable
    this.filteredVariable.next(
      this.variableList.filter(vari => vari.name.toLowerCase().indexOf(search) > -1)
    );
  }
}
