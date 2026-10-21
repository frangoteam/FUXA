import { Component, EventEmitter, Inject, Input, OnInit, Output } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { GaugeAction, Gauge3dProperty, GaugeRangeProperty, ThreeDOptions } from '../../../../_models/hmi';
import { FlexAuthValues } from '../../../gauge-property/flex-auth/flex-auth.component';
import { FlexDeviceTagValueType } from '../../../gauge-property/flex-device-tag/flex-device-tag.component';
import { Device, DevicesUtils } from '../../../../_models/device';
import { ProjectService } from '../../../../_services/project.service';
import { TranslateService } from '@ngx-translate/core';
import { UploadFile } from '../../../../_models/project';

@Component({
    selector: 'app-three-d-property',
    templateUrl: './three-d-property.component.html',
    styleUrls: ['./three-d-property.component.scss']
})
export class ThreeDPropertyComponent implements OnInit {

    @Input() data: any;
    @Output() onPropChanged: EventEmitter<any> = new EventEmitter();
    @Input('reload') set reload(b: any) {
        this._reload();
    }

    property: Gauge3dProperty;
    name: string;
    devices: Device[] = [];
    actionTypes = ['rotate-speed', 'part-visibility', 'part-color'];
    uploading = false;

    constructor(
        public dialogRef: MatDialogRef<ThreeDPropertyComponent>,
        private projectService: ProjectService,
        private translateService: TranslateService,
        @Inject(MAT_DIALOG_DATA) public dialogData: any) {
    }

    ngOnInit() {
        // dialog mode: data comes from MAT_DIALOG_DATA; keep @Input for potential embedded use
        if (!this.data && this.dialogData) {
            this.data = this.dialogData;
        }
        this.initFromInput();
    }

    initFromInput() {
        this.name = this.data.settings.name;
        // deep copy to avoid mutating live settings while editing in the dialog
        this.property = JSON.parse(JSON.stringify(this.data.settings.property)) || new Gauge3dProperty();
        if (!this.property.options) {
            this.property.options = new ThreeDOptions();
        }
        if (!this.property.actions) {
            this.property.actions = [];
        }
        this.property.actions.forEach(action => {
            if (!action.range) {
                action.range = new GaugeRangeProperty();
                action.range.min = 0;
                action.range.max = 100;
            }
            if (!action.options) {
                action.options = {};
            }
        });
        this.devices = this.projectService.getDeviceList();
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.data.settings.name = this.name;
        this.data.settings.property = this.property;
        this.dialogRef.close(this.data);
    }

    /** upload a gltf/glb model file, the address is set to the uploaded location */
    onSetModel(event) {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) {
            return;
        }
        const file = input.files[0];
        const filename = file.name;
        const fileExt = filename.split('.').pop().toLowerCase();
        if (fileExt !== 'glb' && fileExt !== 'gltf') {
            return;
        }
        const fileToUpload = {
            type: fileExt,
            name: filename.split('/').pop(),
            data: null
        };
        this.uploading = true;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                fileToUpload.data = reader.result;
                this.projectService.uploadFile(fileToUpload).subscribe((result: UploadFile) => {
                    this.uploading = false;
                    this.property.options.address = result.location;
                }, () => {
                    this.uploading = false;
                });
            } catch (err) {
                this.uploading = false;
                console.error(err);
            }
        };
        reader.readAsDataURL(file);
        // allow selecting the same file again
        input.value = '';
    }

    onClearModel() {
        this.property.options.address = null;
    }

    /** manual edit of the address input (kept editable next to the uploaded value) */
    onAddressChanged() {
        // value is already bound by ngModel, nothing else to do (saved on dialog ok)
    }

    /** clear background color -> transparent (renderer is created with alpha: true) */
    onClearColor() {
        this.property.options.bgColor = '';
    }

    /** color picked from the palette (also un-disables when currently transparent) */
    onColorChange(color: string) {
        this.property.options.bgColor = color;
    }

    onFlexAuthChanged(flexAuth: FlexAuthValues) {
        this.name = flexAuth.name;
        this.property.permission = flexAuth.permission;
        this.property.permissionRoles = flexAuth.permissionRoles;
    }

    onTagChanged(deviceTag: FlexDeviceTagValueType) {
        this.property.variableId = deviceTag.variableId;
    }

    onAddAction() {
        let action = new GaugeAction();
        action.type = 'rotate-speed';
        action.range = new GaugeRangeProperty();
        action.range.min = 0;
        action.range.max = 100;
        this.property.actions.push(action);
    }

    onRemoveAction(index: number) {
        this.property.actions.splice(index, 1);
    }

    onActionTagChanged(action: GaugeAction, deviceTag: FlexDeviceTagValueType) {
        action.variableId = deviceTag.variableId;
    }

    getActionTag(action: GaugeAction) {
        let tag = DevicesUtils.getTagFromTagId(this.devices, action.variableId);
        return tag?.label || tag?.name;
    }

    getActionTypeText(type: string) {
        return this.translateService.instant('three-d.action-' + type);
    }

    private _reload() {
        this.property = this.data?.settings?.property;
        this.initFromInput();
    }
}
