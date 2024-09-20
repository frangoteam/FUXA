import { Component, Input, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { ReplaySubject, Subject } from 'rxjs';

import { FlexInputComponent } from '../flex-input/flex-input.component';
import { GaugeProperty, IPropertyVariable, WidgetProperty } from '../../../_models/hmi';
import { Device, Tag } from '../../../_models/device';
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
export class FlexHeadComponent implements OnInit, OnDestroy {

    @Input() data: any;
    @Input() property: GaugeProperty | WidgetProperty;
    @Input() withStaticValue = true;
    @Input() withBitmask = false;
    @ViewChild('flexinput', {static: false}) flexInput: FlexInputComponent;

    variable: any;
    withProperty = null;
    alarme: any;
    currentTag: Tag = null;
    defaultValue: any;
    defaultColor = Utils.defaultColor;

    // alarm: string;
    public alarmDeviceCtrl: UntypedFormControl = new UntypedFormControl();
    public alarmDeviceFilterCtrl: UntypedFormControl = new UntypedFormControl();

    public alarmCtrl: UntypedFormControl = new UntypedFormControl();
    public alarmFilterCtrl: UntypedFormControl = new UntypedFormControl();

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

    ngOnDestroy() {
        this._onDestroy.next();
        this._onDestroy.complete();
    }

    getProperty() {
        if (this.withProperty) {
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

    setVariable(event: IPropertyVariable) {
        this.property.variableId = event.variableId;
        this.property.variableValue = event.variableValue;
        this.property.bitmask = event.bitmask;

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
