import { Component, Input, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormControl } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';
import { ReplaySubject, Subject } from 'rxjs';

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
    withInput = null;
    alarme: any;
    currentTag: Tag = null;
    defaultValue: any;
    defaultColor = Utils.defaultColor;

    // alarm: string;
    public alarmDeviceCtrl: FormControl = new FormControl();
    public alarmDeviceFilterCtrl: FormControl = new FormControl();

    public alarmCtrl: FormControl = new FormControl();
    public alarmFilterCtrl: FormControl = new FormControl();

    /** list of variable filtered by search keyword */
    public filteredAlarmDevice: ReplaySubject<Device[]> = new ReplaySubject<Device[]>(1);
    /** list of variable filtered by search keyword */
    public filteredAlarm: ReplaySubject<Variable[]> = new ReplaySubject<Variable[]>(1);

    /** Subject that emits when the component has been destroyed. */
    private _onDestroy = new Subject<void>();

    constructor() {
    }

    ngOnInit() {
        if (!this.property) {
            this.property = new GaugeProperty();
        }
    }

    ngAfterViewInit() {
    }

    ngOnDestroy() {
        this._onDestroy.next();
        this._onDestroy.complete();
    }

    getProperty() {
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

    setVariable(event) {
        this.property.variableId = event.variableId;
        this.property.variableValue = event.variableValue;

        if (this.flexInput) {
            this.flexInput.changeTag(event.variableRaw);
        }
    }

    onAddInput() {
        this.flexInput.onAddInput();
    }

    onRangeViewToggle(slideView) {
        this.flexInput.onRangeViewToggle(slideView);
        this.flexInput.changeTag(this.currentTag);
    }
}
