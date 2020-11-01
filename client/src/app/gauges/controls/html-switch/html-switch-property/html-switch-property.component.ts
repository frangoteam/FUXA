import { Component, OnInit, Inject, ViewChild, AfterContentInit } from '@angular/core';

import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { GaugeProperty } from '../../../../_models/hmi';

import { FlexAuthComponent } from '../../../gauge-property/flex-auth/flex-auth.component';
import { FlexHeadComponent } from '../../../gauge-property/flex-head/flex-head.component';
import { HtmlSwitchComponent } from '../html-switch.component';
import { NgxSwitchComponent, SwitchOptions } from '../../../../gui-helpers/ngx-switch/ngx-switch.component';
import { Define } from '../../../../_helpers/define';
import { Utils } from '../../../../_helpers/utils';

@Component({
    selector: 'app-html-switch-property',
    templateUrl: './html-switch-property.component.html',
    styleUrls: ['./html-switch-property.component.scss']
})
export class HtmlSwitchPropertyComponent implements AfterContentInit {

    @ViewChild('switcher') switcher: NgxSwitchComponent;
	@ViewChild('flexhead') flexhead: FlexHeadComponent;
    @ViewChild('flexauth') flexauth: FlexAuthComponent;

    property: GaugeProperty;
    options: SwitchOptions;
    name: string;
    switchWidth = 80;
    switchHeight = 40;
    fonts = Define.fonts;
    defaultColor = Utils.defaultColor;

    constructor(public dialogRef: MatDialogRef<HtmlSwitchPropertyComponent>,
                @Inject(MAT_DIALOG_DATA) public data: any) {
        this.property = <GaugeProperty>JSON.parse(JSON.stringify(this.data.settings.property));
        if (!this.property) {
            this.property = new GaugeProperty();
        }
        this.name = this.data.settings.name;
        this.options = <SwitchOptions>this.property.options;
        if (!this.options) {
            this.options = new SwitchOptions();
        }
        let switchsize = HtmlSwitchComponent.getSize(this.data.settings);
        this.switchHeight = switchsize.height;
        this.switchWidth = switchsize.width;
        this.options.height = this.switchHeight;
    }

    ngAfterContentInit() {
        this.updateOptions();
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.data.settings.property = this.property;
        this.data.settings.property.permission = this.flexauth.permission;
        this.data.settings.property.options = this.options;
        this.data.settings.name = this.flexauth.name;
    }

    updateOptions() {
        this.switcher.setOptions(this.options);
    }
}
