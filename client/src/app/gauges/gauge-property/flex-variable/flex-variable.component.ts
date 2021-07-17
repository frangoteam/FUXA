import { Component, EventEmitter, Input, OnInit, Output, SimpleChanges } from '@angular/core';
import { ReplaySubject, Subject } from 'rxjs';
import { FormControl } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';

import { Device, DeviceType, Tag, TAG_PREFIX } from '../../../_models/device';
import { HmiService } from '../../../_services/hmi.service';
import { Utils } from '../../../_helpers/utils';

interface Variable {
    id: string;
    name: string;
}

@Component({
    selector: 'flex-variable',
    templateUrl: './flex-variable.component.html',
    styleUrls: ['./flex-variable.component.css']
})
export class FlexVariableComponent implements OnInit {
    @Input() data: any;
    // Legacy
    @Input() variableId: string;
    @Input() value: any;
    @Input() tobind = false;

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

        let selDevice: Device = null;
        if (this.data.devices) {
            if (this.value.variableId) {
                this.data.devices.forEach((dev: Device) => {
                    if (dev.tags[this.value.variableId]) {
                        selDevice = dev;
                    }
                });
            }
            this.loadDevices();
        }
        // set value
        if (selDevice) {
            this.deviceCtrl.setValue(selDevice);
            this.setDevice(this.deviceCtrl);
            if (this.variableList) {
                for (let i = 0; i < this.variableList.length; i++) {
                    if (this.variableList[i].id === this.variableId) {
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
                variableId: this.variableId
            }
        }

        if (typeof this.value.variable == 'undefined') {
            this.value.variable = '';
        }
    }

    getVariableLabel(vari) {
        return vari.label || vari.name;

    }

    setDevice(event) {
        if (event.value) {
            this.variableList = [];
            this.currentVariable = null;
            if (event.value.tags) {
                this.variableList = Object.values(event.value.tags);
                this.loadVariable(this.value.variableId);
            }
        }
    }

    onDeviceChange(event) {
        this.setDevice(event);
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
        if (this.currentVariable) {
            this.value.variableId = this.currentVariable.id;
            this.value.variableRaw = this.currentVariable;
        }
        this.onchange.emit(this.value);   // Legacy
        this.valueChange.emit(this.value);
    }

    private getDevices() {
        if (this.allowManualEdit) {
            let result = this.data.devices.filter((d: Device) => d.type === DeviceType.internal);
            return result;
        }
        return this.data.devices.slice();
    }

    private loadDevices() {
        // load the initial variable list
        this.filteredDevice.next(this.getDevices());
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
            this.filteredDevice.next(this.getDevices());
            return;
        } else {
            search = search.toLowerCase();
        }
        // filter the device
        this.filteredDevice.next(
            this.getDevices().filter(dev => dev.name.toLowerCase().indexOf(search) > -1)
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
        if (this.deviceCtrl.value.type === DeviceType.external) {
            this.filteredVariable.next(
                this.variableList.filter(vari => (vari.name && vari.name.toLowerCase().indexOf(search) > -1) || (vari.address && vari.address.toLowerCase().indexOf(search) > -1))
            );
        } else {
            this.filteredVariable.next(
                this.variableList.filter(vari => vari.name.toLowerCase().indexOf(search) > -1)
            );  
        }
    }
}
