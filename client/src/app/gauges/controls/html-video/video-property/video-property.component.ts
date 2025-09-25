import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { GaugeAction, GaugeVideoProperty } from '../../../../_models/hmi';
import { FlexAuthValues } from '../../../gauge-property/flex-auth/flex-auth.component';
import { FlexDeviceTagValueType } from '../../../gauge-property/flex-device-tag/flex-device-tag.component';
import { ActionPropertiesData, ActionPropertiesDialogComponent } from '../../../gauge-property/action-properties-dialog/action-properties-dialog.component';
import { Device, DevicesUtils } from '../../../../_models/device';
import { ProjectService } from '../../../../_services/project.service';
import { ActionPropertyService } from '../../../gauge-property/action-properties-dialog/action-property.service';
import { UploadFile } from '../../../../_models/project';

@Component({
    selector: 'app-video-property',
    templateUrl: './video-property.component.html',
    styleUrls: ['./video-property.component.scss']
})
export class VideoPropertyComponent implements OnInit {

    @Input() data: any;
    @Output() onPropChanged: EventEmitter<any> = new EventEmitter();
    @Input('reload') set reload(b: any) {
        this._reload();
    }

    property: GaugeVideoProperty;
    name: string;
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
        this.name = this.data.settings.name;
        this.property = <GaugeVideoProperty>this.data.settings.property || new GaugeVideoProperty();
        this.devices = this.projectService.getDeviceList();
    }

    onFlexAuthChanged(flexAuth: FlexAuthValues) {
        this.name = flexAuth.name;
        this.property.permission = flexAuth.permission;
        this.property.permissionRoles = flexAuth.permissionRoles;
        this.onVideoChanged();
    }

    onVideoChanged() {
        this.data.settings.name = this.name;
        this.data.settings.property = this.property;
        this.onPropChanged.emit(this.data.settings);
    }

    onTagChanged(daveiceTag: FlexDeviceTagValueType) {
        this.data.settings.property.variableId = daveiceTag.variableId;
        this.onPropChanged.emit(this.data.settings);
    }

    getActionTag(action: GaugeAction) {
        let tag = DevicesUtils.getTagFromTagId(this.devices, action.variableId);
        return tag?.label || tag?.name;
    }
    getActionType(action: GaugeAction) {
        return this.actionPropertyService.typeToText(action.type);
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
                this.onVideoChanged();
            }
        });
    }

    onSetImage(event) {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) {
            return;
        }
        const file = input.files[0];
        const filename = file.name;
        const fileExt = filename.split('.').pop().toLowerCase();

        const fileToUpload = {
            type: fileExt,
            name: filename.split('/').pop(),
            data: null
        };
        let reader = new FileReader();

        reader.onload = () => {
            try {
                fileToUpload.data = reader.result;
                this.projectService.uploadFile(fileToUpload).subscribe((result: UploadFile) => {
                    this.property.options.initImage = result.location;
                    this.onVideoChanged();
                });
            } catch (err) {
                console.error(err);
            }
        };
        if (fileExt === 'svg') {
            reader.readAsText(file);
        } else {
            reader.readAsDataURL(file);
        }
    }

    onClearImage() {
        this.property.options.initImage = null;
        this.onVideoChanged();
    }

    private _reload() {
        this.property = this.data?.settings?.property;
        this.initFromInput();
    }
}
