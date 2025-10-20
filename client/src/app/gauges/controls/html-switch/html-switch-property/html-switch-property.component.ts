import { Component, Inject, ViewChild, OnInit, AfterViewInit } from '@angular/core';

import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';
import { GaugeProperty } from '../../../../_models/hmi';

import { FlexAuthComponent } from '../../../gauge-property/flex-auth/flex-auth.component';
import { FlexHeadComponent } from '../../../gauge-property/flex-head/flex-head.component';
import { HtmlSwitchComponent } from '../html-switch.component';
import { NgxSwitchComponent, SwitchOptions } from '../../../../gui-helpers/ngx-switch/ngx-switch.component';
import { Define } from '../../../../_helpers/define';
import { Utils } from '../../../../_helpers/utils';
import { FlexEventComponent } from '../../../gauge-property/flex-event/flex-event.component';

@Component({
    selector: 'app-html-switch-property',
    templateUrl: './html-switch-property.component.html',
    styleUrls: ['./html-switch-property.component.scss']
})
export class HtmlSwitchPropertyComponent implements OnInit, AfterViewInit {

    @ViewChild('switcher', {static: false}) switcher: NgxSwitchComponent;
	@ViewChild('flexhead', {static: false}) flexhead: FlexHeadComponent;
    @ViewChild('flexauth', {static: false}) flexauth: FlexAuthComponent;
    @ViewChild('flexevent', {static: false}) flexEvent: FlexEventComponent;

    property: GaugeProperty;
    options: SwitchOptions;
    name: string;
    switchWidth = 80;
    switchHeight = 40;
    fonts = Define.fonts;
    defaultColor = Utils.defaultColor;
    withBitmask = false;
	eventsSupported: boolean;

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
        this.eventsSupported = this.data.withEvents;
    }

    ngOnInit(): void {
        if (this.data.withBitmask) {
            this.withBitmask = this.data.withBitmask;
        }
    }

    ngAfterViewInit() {
        this.updateOptions();
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.data.settings.property = this.property;
        this.data.settings.property.permission = this.flexauth.permission;
        this.data.settings.property.permissionRoles = this.flexauth.permissionRoles;
        this.data.settings.property.options = this.options;
        this.data.settings.name = this.flexauth.name;
        if (this.flexEvent) {
            this.data.settings.property.events = this.flexEvent.getEvents();
        }
    }

    onAddEvent() {
        this.flexEvent.onAddEvent();
    }

    updateOptions() {
        this.switcher?.setOptions(this.options);
    }
}
