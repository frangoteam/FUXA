import { Component, EventEmitter, OnInit, Input, Output } from '@angular/core';

import { TranslateService } from '@ngx-translate/core';
import { GaugeIframeProperty } from '../../../../_models/hmi';

@Component({
    selector: 'app-iframe-property',
    templateUrl: './iframe-property.component.html',
    styleUrls: ['./iframe-property.component.scss']
})
export class IframePropertyComponent implements OnInit {

    @Input() data: any;
    @Output() onPropChanged: EventEmitter<any> = new EventEmitter();
    @Input('reload') set reload(b: any) {
        this._reload();
    }

    property: GaugeIframeProperty;

    constructor(private translateService: TranslateService) {
    }

    ngOnInit() {
        this._reload();
    }

    onPropertyChanged() {
        this.onPropChanged.emit(this.data.settings);
    }

    onTagChanged(variableId: string) {
        this.data.settings.property.variableId = variableId;
        this.onPropChanged.emit(this.data.settings);
    }

    private _reload() {
        if (!this.data.settings.property) {
            this.data.settings.property = <GaugeIframeProperty>{ address: null, variableId: null };
        }
        this.property = this.data.settings.property;
    }
}
