/* eslint-disable @angular-eslint/component-selector */
import { Component, OnInit, Input } from '@angular/core';

@Component({
    selector: 'range-number',
    templateUrl: './range-number.component.html',
    styleUrls: ['./range-number.component.css']
})
export class RangeNumberComponent implements OnInit {
    @Input() range: IItemRange = { min: 0, max: 100 };

    isNumber = true;
    booleanValue = 1;
    oldRange: IItemRange = { min: 0, max: 100 };
    constructor() { }

    ngOnInit() {
        this.saveOld(this.range);
    }

    onBooleanChanged() {
        this.range.min = this.booleanValue;
        this.range.max = this.booleanValue;
    }

    onTypeChanged() {
        if (this.isNumber) {
            this.range.min = this.oldRange.min;
            this.range.max = this.oldRange.max;
        } else {
            this.booleanValue = (this.range.min === this.range.max && this.range.min >= 1) ? 1 : 0;
            this.onBooleanChanged();
        }
    }

    private saveOld(oldValue: IItemRange) {
        this.oldRange.min = oldValue.min;
        this.oldRange.max = oldValue.max;
    }
}

interface IItemRange {
    min: number;
    max: number;
}
