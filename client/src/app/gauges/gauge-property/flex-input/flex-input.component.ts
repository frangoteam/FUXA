import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { Options } from 'ng5-slider';

import { GaugeRangeProperty } from '../../../_models/hmi';
import { Tag } from '../../../_models/device';
import { Utils } from '../../../_helpers/utils';

@Component({
    selector: 'flex-input',
    templateUrl: './flex-input.component.html',
    styleUrls: ['./flex-input.component.css']
})
export class FlexInputComponent implements OnInit {

    @Input() ranges: GaugeRangeProperty[];
    @Input() type: string;
    @Input() inputType: string;
    @Input() default: any;

    tag: Tag = null;
    withLabel = true;
    withValue = true;
    slideView = true;
    defaultColor = Utils.defaultColor;
    options: Options = {
        floor: 0,
        ceil: 100
    };
    valueresult = '123';

    constructor() { }

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
        } else if (this.isWithUnit()) {
            if (this.ranges[0]['fractionDigits']) {
                this.onChangeFormat('fractionDigits', this.ranges[0]['fractionDigits']);
            }
        }
        // this.ranges.forEach(element => {
        //   this.addInput(element.type, element.min, element.max, element.color);
        // });
    }

    onAddInput() {
        let ip: GaugeRangeProperty = new GaugeRangeProperty();
        ip.type = this.type;
        this.addInput(ip);
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
            element.type = this.inputType;
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
        if (this.tag) {
            const newOptions: Options = Object.assign({}, this.options);
            try {
                if (this.tag.min != null) {
                    newOptions.floor = parseInt(this.tag.min);
                }
                if (this.tag.max != null) {
                    newOptions.ceil = parseInt(this.tag.max);
                }
                this.options = newOptions;
            } catch (e) { }
            for (let i = 0; i < this.ranges.length; i++) {
                if (!this.ranges[i].min || this.ranges[i].min <= newOptions.floor) {
                    this.ranges[i].min = newOptions.floor;
                }
                if (!this.ranges[i].max || this.ranges[i].max >= newOptions.ceil) {
                    this.ranges[i].max = newOptions.ceil;
                }
            }
        }
    }

    isWithRange() {
        if (this.inputType === 'range') {
            return true;
        }
        return false;
    }

    isMinMax() {
        if (this.inputType === 'minmax') {
            return true;
        }
        return false;
    }

    isWithRangeColor() {
        if (this.inputType === 'range') {
            return true;
        }
        return false;
    }

    isWithStep() {
        if (this.inputType === 'step') {
            return true;
        }
        return false;
    }

    isWithUnit() {
        if (this.inputType === 'unit') {
            return true;
        }
        return false;
    }

    onChangeFormat(formattype, value) {
        this.valueresult = parseFloat(this.valueresult).toFixed(value);
    }

    private addInput(gap: GaugeRangeProperty) {
        this.ranges.push(gap);
    }
}

export enum InputItemType {
    Color,
}