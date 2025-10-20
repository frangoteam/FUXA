import { Component, OnInit, ViewChild, Input, Output, EventEmitter } from '@angular/core';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';

import { GaugeAction, GaugeProperty, View } from '../../../../_models/hmi';
import { FlexHeadComponent } from '../../../gauge-property/flex-head/flex-head.component';
import { FlexAuthComponent, FlexAuthValues } from '../../../gauge-property/flex-auth/flex-auth.component';
import { FlexEventComponent } from '../../../gauge-property/flex-event/flex-event.component';
import { FlexActionComponent } from '../../../gauge-property/flex-action/flex-action.component';
import { Utils } from '../../../../_helpers/utils';
import { PipeOptions } from '../pipe.component';
import { GaugeDialogType } from '../../../gauge-property/gauge-property.component';
import { ActionPropertiesData, ActionPropertiesDialogComponent } from '../../../gauge-property/action-properties-dialog/action-properties-dialog.component';
import { ProjectService } from '../../../../_services/project.service';
import { Device, DevicesUtils } from '../../../../_models/device';
import { ActionPropertyService } from '../../../gauge-property/action-properties-dialog/action-property.service';
import { UploadFile } from '../../../../_models/project';

declare var SVG: any;

@Component({
    selector: 'app-pipe-property',
    templateUrl: './pipe-property.component.html',
    styleUrls: ['./pipe-property.component.scss']
})
export class PipePropertyComponent implements OnInit  {
    @Input() data: PipePropertyData;
    @Output() onPropChanged: EventEmitter<any> = new EventEmitter();
    @Input('reload') set reload(b: any) {
        this._reload();
    }

	@ViewChild('flexauth', {static: false}) flexAuth: FlexAuthComponent;
    @ViewChild('flexhead', {static: false}) flexHead: FlexHeadComponent;
    @ViewChild('flexevent', {static: false}) flexEvent: FlexEventComponent;
    @ViewChild('flexaction', {static: false}) flexAction: FlexActionComponent;
    property: GaugeProperty;
    options: PipeOptions;
    views: View[];
    name: string;
    defaultColor = Utils.defaultColor;
    pipepath = { bk: null, fg: null, hp: null };
    devices: Device[] = [];

    constructor(
        private dialog: MatDialog,
        private projectService: ProjectService,
        private actionPropertyService: ActionPropertyService) {
    }

    ngOnInit() {
        this.initFromInput();
    }

    initFromInput() {
        let emitChange = Utils.isNullOrUndefined(this.data.settings.property) || Utils.isNullOrUndefined(this.data.settings.property.options);
        this.name = this.data.settings.name;
        this.property = this.data.settings.property || new GaugeProperty();
        if (!this.property) {
            this.property = new GaugeProperty();
        }
        this.options = <PipeOptions>this.property.options ?? new PipeOptions();
        this.devices = this.projectService.getDeviceList();

        if (emitChange) {
            setTimeout(() => {
                this.onPipeChanged();
            }, 0);
        }
    }

    onFlexAuthChanged(flexAuth: FlexAuthValues) {
        this.name = flexAuth.name;
        this.property.permission = flexAuth.permission;
        this.property.permissionRoles = flexAuth.permissionRoles;
        this.onPipeChanged();
    }

    onPipeChanged() {
        this.data.settings.name = this.name;
        this.data.settings.property = this.property;
        this.data.settings.property.options = this.options;
        this.onPropChanged.emit(this.data.settings);
    }

    onEditActions() {
        let dialogRef = this.dialog.open(ActionPropertiesDialogComponent, {
            disableClose: true,
            data: <ActionPropertiesData>{
                withActions: this.data.withActions,
                property: JSON.parse(JSON.stringify(this.property))
            },
            position: { top: '60px' }
        });

        dialogRef.afterClosed().subscribe((result: ActionPropertiesData) => {
            if (result) {
                this.property = result.property;
                this.onPipeChanged();
            }
        });
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
        this.onPipeChanged();
    }

    onAddEvent() {
		this.flexEvent.onAddEvent();
	}

	onAddAction() {
		this.flexAction.onAddAction();
	}

    getActionTag(action: GaugeAction) {
        let tag = DevicesUtils.getTagFromTagId(this.devices, action.variableId);
        return tag?.label || tag?.name;
    }
    getActionType(action: GaugeAction) {
        return this.actionPropertyService.typeToText(action.type);
    }

    onSetImage(event) {
        if (event.target.files) {
            let filename = event.target.files[0].name;
            let fileToUpload = { type: filename.split('.').pop().toLowerCase(), name: filename.split('/').pop(), data: null };
            let reader = new FileReader();
            reader.onload = () => {
                try {
                    fileToUpload.data = reader.result;
                    this.projectService.uploadFile(fileToUpload).subscribe((result: UploadFile) => {
                        this.options.imageAnimation = {
                            imageUrl: result.location,
                            delay: 3000,
                            count: 1
                        };
                        this.onPipeChanged();
                    });
                } catch (err) {
                    console.error(err);
                }
            };
            if (fileToUpload.type === 'svg') {
                reader.readAsText(event.target.files[0]);
            }
        }
    }

    onClearImage() {
        this.options.imageAnimation = null;
        this.onPipeChanged();
    }

    private _reload() {
        this.property = this.data?.settings?.property;
        this.initFromInput();
    }
}

export interface PipePropertyData {
    settings: any,
    dlgType: GaugeDialogType,
    names: string[],
    withEvents: boolean,
    withActions: any,
}
