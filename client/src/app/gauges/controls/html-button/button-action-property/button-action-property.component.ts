import { Component, Input, OnInit } from '@angular/core';
import { ButtonActionMode, ButtonActionProperty, GaugeProperty } from '../../../../_models/hmi';
import { Utils } from '../../../../_helpers/utils';
import { HtmlButtonComponent } from '../html-button.component';

@Component({
    selector: 'button-action-property',
    templateUrl: './button-action-property.component.html',
    styleUrls: ['./button-action-property.component.scss']
})
export class ButtonActionPropertyComponent implements OnInit {

    @Input() property: GaugeProperty;

    modeType = ButtonActionMode;
    maxHoldTime = HtmlButtonComponent.MaxHoldTime;

    ngOnInit() {
        this.property.buttonAction = <ButtonActionProperty>{
            mode: ButtonActionMode.none,
            offValue: '0',
            onValue: '1',
            pressValue: '1',
            releaseValue: '0',
            minHoldTime: 1,
            setValue: '1',
            showPressed: false,
            ...this.property.buttonAction
        };
    }

    get action(): ButtonActionProperty {
        return this.property.buttonAction;
    }

    isEmpty(value: string): boolean {
        return Utils.isNullOrUndefined(value) || String(value).trim() === '';
    }

    isHoldTimeInvalid(): boolean {
        return !HtmlButtonComponent.isHoldTimeValid(this.action.minHoldTime);
    }
}
