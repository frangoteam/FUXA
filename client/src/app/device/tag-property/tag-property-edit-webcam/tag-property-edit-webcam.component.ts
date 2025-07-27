import { Component, EventEmitter, Inject, OnInit, Output } from '@angular/core';
import {
    AbstractControl,
    UntypedFormBuilder,
    UntypedFormGroup,
    ValidationErrors,
    ValidatorFn,
    Validators
} from '@angular/forms';
import { Device, ServerTagType, Tag } from '../../../_models/device';
import { TranslateService } from '@ngx-translate/core';
import { MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';

@Component({
    selector: 'app-tag-property-edit-internal',
    templateUrl: './tag-property-edit-webcam.component.html',
    styleUrls: ['./tag-property-edit-webcam.component.scss']
})
export class TagPropertyEditWebcamComponent implements OnInit {
    @Output() result = new EventEmitter<any>();
    formGroup: UntypedFormGroup;
    readonly tagType = ServerTagType;
    readonly outputType = OutputType;
    readonly callbackReturnType = WebcamCallbackReturnType;
    existingNames = [];
    error: string;

    constructor(private fb: UntypedFormBuilder,
        private translateService: TranslateService,
        public dialogRef: MatDialogRef<TagPropertyEditWebcamComponent>,
        @Inject(MAT_DIALOG_DATA) public data: TagPropertyWebcamData) { }

    ngOnInit() {
        this.formGroup = this.fb.group({
            deviceName: [this.data.device.name, Validators.required],
            tagName: [this.data.tag.name, [Validators.required, this.validateName()]],
            tagAddress: [this.data.tag.address],
            tagType: [this.data.tag.type],
            tagInit: [this.data.tag.init],
            tagDescription: [this.data.tag.description],
            tagOptions: this.fb.group({
                    width: this.data.tag.options?.width || 1280,
                    height:this.data.tag.options?.height ||  720,
                    frames:this.data.tag.options?.frames || 60,
                    quality: this.data.tag.options?.quality || 100,
                    output: this.data.tag.options?.output || OutputType.jpeg,
                    callbackReturn: this.data.tag.options?.callbackReturn || WebcamCallbackReturnType.location
            }),
        });
        this.formGroup.updateValueAndValidity();
        Object.keys(this.data.device.tags).forEach((key) => {
            let tag = this.data.device.tags[key];
            if (tag.id) {
                if (tag.id !== this.data.tag.id) {
                    this.existingNames.push(tag.name);
                }
            } else if (tag.name !== this.data.tag.name) {
                this.existingNames.push(tag.name);
            }
        });
    }

    validateName(): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            this.error = null;
            if (this.existingNames.indexOf(control.value) !== -1) {
                return { name: this.translateService.instant('msg.device-tag-exist') };
            }
            return null;
        };
    }

    onNoClick(): void {
        this.result.emit();
    }

    onOkClick(): void {
        this.result.emit(this.formGroup.getRawValue());
    }

}

export interface TagPropertyWebcamData {
    device: Device;
    tag: Tag;
}


export enum WebcamCallbackReturnType {
    location = 'location',
    // buffer = 'buffer', not support now
    base64 ='base64'
}

export enum OutputType {
    jpeg = 'jpeg',
    png = 'png',
}
