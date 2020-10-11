import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { ReplaySubject } from 'rxjs';
import { FormControl } from '@angular/forms';
import { take, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

import { Device } from '../../../_models/device';
import { HmiService } from '../../../_services/hmi.service';

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
    @Input() variableSrc: string;
    @Input() variableId: string;
    @Input() variable: string;
    @Output() onchange: EventEmitter<any> = new EventEmitter();

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

    constructor() { }

    ngOnInit() {
        let seldevice = null;
        let selalarmdevice = null;
        if (this.data.devices) {
            if (this.variableSrc) {
                this.data.devices.forEach(dev => {
                    if (this.variableSrc && dev.name === this.variableSrc) {
                        seldevice = dev;
                    }
                });
            }
            this.loadDevices();
        }
        // set value
        if (seldevice) {
            this.deviceCtrl.setValue(seldevice);
            this.onDeviceChange(this.deviceCtrl);
            if (this.variableList) {
                for (let i = 0; i < this.variableList.length; i++) {
                    if (this.variableList[i].id === this.variable) {
                        this.currentVariable = this.variableList[i];
                    }
                }
            }
        }
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
            if (this.variableSrc !== event.value.name) {
                this.variable = '';
                this.variableId = '';
            }
            this.variableSrc = event.value.name;
            this.variableList = [];
            this.currentVariable = null;
            if (event.value.tags) {
                this.variableList = Object.values(event.value.tags);
                this.loadVariable(this.variable);
            }
        }
        this.onChanged();
    }

    onVariableChange(event) {
        if (event.value) {
            this.variable = event.value.name;
            this.variableId = HmiService.toVariableId(this.variableSrc, this.variable);
        }
        this.currentVariable = event.value;
        this.onChanged();
    }

    onChanged() {
        this.onchange.emit({ variableSrc: this.variableSrc, variableId: this.variableId, variable: this.variable });
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
