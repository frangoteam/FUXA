import { Component, EventEmitter, OnInit, Inject, Output } from '@angular/core';
import { AbstractControl, UntypedFormBuilder, UntypedFormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import {Device, GpioDirectionType, GpioEdgeType, Tag} from '../../../_models/device';
import { TranslateService } from '@ngx-translate/core';
import { MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';

@Component({
    selector: 'app-tag-property-edit-gpio',
    templateUrl: './tag-property-edit-gpio.component.html',
    styleUrls: ['./tag-property-edit-gpio.component.scss']
})
export class TagPropertyEditGpioComponent implements OnInit {
    @Output() result = new EventEmitter<any>();
    formGroup: UntypedFormGroup;
    directionType = GpioDirectionType;
    edgeType = GpioEdgeType;
    existingNames = [];
    error: string;

    constructor(private fb: UntypedFormBuilder,
        private translateService: TranslateService,
        public dialogRef: MatDialogRef<TagPropertyEditGpioComponent>,
        @Inject(MAT_DIALOG_DATA) public data: TagPropertyGpioData) { }

    ngOnInit() {
        this.formGroup = this.fb.group({
            deviceName: [this.data.device.name, Validators.required],
            tagName: [this.data.tag.name, [Validators.required, this.validateName()]],
            tagAddress: [this.data.tag.address, [Validators.required]],
            tagDescription: [this.data.tag.description],
            tagDirection: [this.data.tag.direction, Validators.required],
            tagEdge: [this.data.tag.edge],
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
            const name = control?.value;
            if (this.existingNames.indexOf(name) !== -1) {
              return { name: this.translateService.instant('msg.device-tag-exist') };
            }
            if (name?.includes('@')) {
              return { name: this.translateService.instant('msg.device-tag-invalid-char') };
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

    protected readonly GpioDirectionType = GpioDirectionType;
}

export interface TagPropertyGpioData {
    device: Device;
    tag: Tag;
}
