import { Component, AfterViewInit, OnInit, Inject, ViewChild } from '@angular/core';

import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { GaugeProperty } from '../../../../_models/hmi';
import { FlexHeadComponent } from '../../../gauge-property/flex-head/flex-head.component';
import { FlexAuthComponent } from '../../../gauge-property/flex-auth/flex-auth.component';
import { FlexEventComponent } from '../../../gauge-property/flex-event/flex-event.component';
import { FlexActionComponent } from '../../../gauge-property/flex-action/flex-action.component';
import { Utils } from '../../../../_helpers/utils';
import { PipeOptions } from '../pipe.component';

declare var SVG: any;

@Component({
    selector: 'pipe-property',
    templateUrl: './pipe-property.component.html',
    styleUrls: ['./pipe-property.component.css']
})
export class PipePropertyComponent implements OnInit, AfterViewInit {

	@ViewChild('flexauth') flexAuth: FlexAuthComponent;
    @ViewChild('flexhead') flexHead: FlexHeadComponent;
    @ViewChild('flexevent') flexEvent: FlexEventComponent;
    @ViewChild('flexaction') flexAction: FlexActionComponent;
    property: GaugeProperty;
    options: PipeOptions;
    name: string;
	eventsSupported: boolean;
    actionsSupported: any;
    defaultColor = Utils.defaultColor;
    pipepath = { bk: null, fg: null, hp: null };
    
    constructor(public dialogRef: MatDialogRef<PipePropertyComponent>,
                @Inject(MAT_DIALOG_DATA) public data: any) { 
    }

    ngOnInit() {
        this.eventsSupported = this.data.withEvents;
		this.actionsSupported = this.data.withActions;
        this.property = <GaugeProperty>JSON.parse(JSON.stringify(this.data.settings.property));
        if (!this.property) {
            this.property = new GaugeProperty();
        }
        this.name = this.data.settings.name;
        this.options = <PipeOptions>this.property.options;
        if (!this.options) {
            this.options = new PipeOptions();
            this.options.borderWidth = 40;
            this.options.border = '#000000';
            this.options.pipeWidth = 30;
            this.options.pipe = '#0000ff';
            this.options.contentWidth = 30;
            this.options.content = '#0044ff';
            this.options.contentSpace = 48;
        }
        // this.permission = this.property.permission;
    }

    ngAfterViewInit() {
        // var draw = SVG().addTo('#pipe').size('100%', '100%');
        var draw = SVG('pipe');
        this.pipepath.bk = draw.path('m 1,120 200,0');
        this.pipepath.fg = draw.path('m 1,120 200,0');
        this.pipepath.hp = draw.path('m 1,120 200,0');
        this.redrawPipe();
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.data.settings.property = this.property;
        this.data.settings.property.permission = this.flexAuth.permission;
        this.data.settings.property.options = this.options;
        this.data.settings.name = this.flexAuth.name;
		if (this.flexEvent) {
			this.data.settings.property.events = this.flexEvent.getEvents();
		}
		if (this.flexAction) {
			this.data.settings.property.actions = this.flexAction.getActions();
		}
    }
    redrawPipe() {
        this.pipepath.fg.stroke({ color: this.options.pipe, width: this.options.pipeWidth});
        this.pipepath.fg.fill('none');
        this.pipepath.bk.stroke({ color: this.options.border, width: this.options.borderWidth});
        this.pipepath.bk.fill('none');
        let space = '' + this.options.contentSpace + ' ' + this.options.contentSpace;
        this.pipepath.hp.stroke({ color: this.options.content, width: this.options.contentWidth, dasharray: space });
        this.pipepath.hp.fill('none');
    }

    onChangeValue(type, value) {
        if (type == 'borderWidth') {
            this.options.borderWidth = value;
        } else if (type == 'border') {
            this.options.border = value;
        } else if (type == 'pipeWidth') {
            this.options.pipeWidth = value;
        } else if (type == 'pipe') {
            this.options.pipe = value;
        } else if (type == 'contentWidth') {
            this.options.contentWidth = value;
        } else if (type == 'content') {
            this.options.content = value;
        } else if (type == 'contentSpace') {
            this.options.contentSpace = value;
        }
        this.redrawPipe();
    }

    onAddEvent() {
		this.flexEvent.onAddEvent();
	}

	onAddAction() {
		this.flexAction.onAddAction();
	}
}
