import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { IPropertyVariable, View } from '../../../_models/hmi';

@Component({
    selector: 'flex-variable-map',
    templateUrl: './flex-variable-map.component.html',
    styleUrls: ['./flex-variable-map.component.scss']
})
export class FlexVariableMapComponent implements OnInit {
    @Input() view: View;
    @Input() data: any;
    @Input() value: any;
    @Input() placeholders: any = [];
    @Output() valueChange: EventEmitter<any> = new EventEmitter();

    constructor() {
    }

    ngOnInit() {
        if (!this.value) {
            this.value = {};
        }
        this.value.from = this.value.from || {};
        this.value.to = this.value.to || {};
    }

    onValueChange() {
        this.valueChange.emit(this.value);
    }

    compareVariables(v1, v2) {
        return v1 && v2 && v1.variableId == v2.variableId;
    }

    isNotUsedInView(): boolean {
        const variableId = this.value?.from?.variableId;
        return !!this.view && !!variableId && !this.placeholders?.some(placeholder => placeholder?.variableId === variableId);
    }
}

export interface VariableMapItemType {
    from: IPropertyVariable;
    to: IPropertyVariable;
}
