import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { GaugeProperty, GaugeRangeProperty, InputConvertionType, InputOptionType, InputOptionsProperty, InputTimeFormatType } from '../../../_models/hmi';
import { DevicesUtils, Tag } from '../../../_models/device';
import { Utils } from '../../../_helpers/utils';
import { FlexVariableComponent } from '../flex-variable/flex-variable.component';
import { MatSelectChange } from '@angular/material/select';

@Component({
    selector: 'flex-input',
    templateUrl: './flex-input.component.html',
    styleUrls: ['./flex-input.component.css']
})
export class FlexInputComponent implements OnInit {
    @Input() data: any;
    @Input() property: GaugeProperty;
    @Input() ranges: GaugeRangeProperty[];
    @Input() type: string;
    @Input() propertyType: PropertyType;
    @Input() default: any;
    @ViewChild('unit', {static: false}) varunit: FlexVariableComponent;
    @ViewChild('digits', {static: false}) vardigits: FlexVariableComponent;


    tag: Tag = null;
    withLabel = true;
    withValue = true;
    slideView = true;
    defaultColor = Utils.defaultColor;
    valueresult = '123';
    inputOptionType = InputOptionType;
    inputTimeFormatType = InputTimeFormatType;
    inputConvertionType = InputConvertionType;

    constructor() {
    }

    ngOnInit() {
        if (!this.ranges) {
            this.ranges = [];
            let ip: GaugeRangeProperty = new GaugeRangeProperty();
            if (this.isWithStep()) {
                ip.type = this.type;
                ip.min = 1;
                ip.max = 1;
            } else if (this.isMinMax()) {
                ip.type = this.type;
                ip.min = 0;
                ip.max = 100;
                ip.style = [true, true];
            } else {
                ip.type = this.type;
                ip.min = 20;
                ip.max = 80;
            }
            this.addInput(ip);
        } else if (this.isMinMax()) {
            if (this.ranges.length > 0 && this.ranges[0].style.length === 2) {
                this.withLabel = this.ranges[0].style[0];
                this.withValue = this.ranges[0].style[1];
            }
        } else if (this.isOutputCtrl()) {
        }
        if (this.isInputCtrl()) {
            this.property.options = this.property.options || <InputOptionsProperty>{ updated: false, numeric: false };
            this.property.options.type = this.property.options.type ? this.property.options.type : this.property.options.numeric ? this.inputOptionType.number : this.inputOptionType.text;
        }
        this.ranges.forEach(range => {
            if (!range.color) {
                range.color = '';
            }
            if (!range.stroke) {
                range.stroke = '';
            }
        });
    }

    onAddInput() {
        let gap: GaugeRangeProperty = new GaugeRangeProperty();
        gap.type = this.type;
        gap.color = '';
        gap.stroke = '';
        this.addInput(gap);
    }

    onRemoveInput(index: number) {
        this.ranges.splice(index, 1);
    }

    onRangeViewToggle(slideView) {
        this.slideView = slideView;
    }

    getRanges() {
        let result = [];
        this.ranges.forEach(element => {
            element.type = this.propertyType;
            if (this.isWithStep()) {
                element.max = element.min;
                if (element.min !== null && element.max !== null) {
                    result.push(element);
                }
            } else if (this.isMinMax()) {
                element.style = [this.withLabel, this.withValue];
                result.push(element);
            } else {
                if (!Utils.isNullOrUndefined(element.min) && !Utils.isNullOrUndefined(element.max)) {
                    result.push(element);
                }
            }
        });
        return result;
    }

    getColor(item) {
        if (item && item.color) {
            return item.color;
        } else if (this.default && this.default.color) {
            return this.default.color;
        }
    }

    changeTag(_tag) {
        this.tag = _tag;
        if (this.isOutputCtrl()) {
            let device = DevicesUtils.getDeviceFromTagId(this.data.devices, _tag?.id);
            if (device) {
                if (this.varunit) {
                    this.varunit.setVariable(DevicesUtils.getTagFromTagAddress(device, _tag.address + 'OpcEngUnit'));
                }
                if (this.vardigits) {
                    this.vardigits.setVariable(DevicesUtils.getTagFromTagAddress(device, _tag.address + 'DecimalPlaces'));
                }
            }
        }
    }

    isWithRange() {
        return this.propertyType === PropertyType.range;
    }

    isMinMax() {
        return this.propertyType === PropertyType.minmax;
    }

    isWithRangeColor() {
        return this.propertyType === PropertyType.range;
    }

    isWithStep() {
        return this.propertyType === PropertyType.step;
    }

    isOutputCtrl() {
        return this.propertyType === PropertyType.output;
    }

    isInputCtrl() {
        return this.propertyType === PropertyType.input;
    }

    isInputMinMax(){
        if (this.data.dlgType === 16) {  // GaugeDialogType.Input
            return true;
        }
        return false;
    }

    onFormatDigitChanged(range: GaugeRangeProperty, event) {
        range['fractionDigitsId'] = event.variableId;
        range['fractionDigits'] = event.variableValue;
    }

    onUnitChanged(range: GaugeRangeProperty, event) {
        range.textId = event.variableId;
        range.text = event.variableValue;
    }

    onTypeChange(select: MatSelectChange) {
        if (!this.property.options.timeformat && (select.value === InputOptionType.time || select.value === InputOptionType.datetime)) {
            this.property.options.timeformat = InputTimeFormatType.normal;
        }
        if (!this.property.options.convertion && (select.value === InputOptionType.time || select.value === InputOptionType.date || select.value === InputOptionType.datetime)) {
            this.property.options.convertion = InputConvertionType.milliseconds;
        }
    }

    private addInput(gap: GaugeRangeProperty) {
        this.ranges.push(gap);
    }
}

export enum InputItemType {
    Color,
}


export enum PropertyType {
    output = 1,
    range = 2,
    text = 3,
    step = 4,
    minmax = 5,
    input = 6,
}
