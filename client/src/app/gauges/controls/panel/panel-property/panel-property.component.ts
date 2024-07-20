import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { GaugePanelProperty, PropertyScaleModeType } from '../../../../_models/hmi';
import { FlexDeviceTagValueType } from '../../../gauge-property/flex-device-tag/flex-device-tag.component';

@Component({
    selector: 'app-panel-property',
    templateUrl: './panel-property.component.html',
    styleUrls: ['./panel-property.component.scss']
})
export class PanelPropertyComponent implements OnInit {

    @Input() data: any;
    @Output() onPropChanged: EventEmitter<any> = new EventEmitter();
    @Input('reload') set reload(b: any) {
        this._reload();
    }
    property: GaugePanelProperty;
    scaleMode = PropertyScaleModeType;

    constructor() { }

    ngOnInit() {
        this._reload();
    }

    onPropertyChanged() {
        this.onPropChanged.emit(this.data.settings);
    }

    onTagChanged(daveiceTag: FlexDeviceTagValueType) {
        this.data.settings.property.variableId = daveiceTag.variableId;
        this.onPropertyChanged();
    }

    private _reload() {
        if (!this.data.settings.property) {
            this.data.settings.property = <GaugePanelProperty>{ viewName: null, variableId: null, scaleMode: null };
        }
        this.property = this.data.settings.property;
    }
}
