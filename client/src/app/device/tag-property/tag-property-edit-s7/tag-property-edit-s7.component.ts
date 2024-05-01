import { Component, EventEmitter, Inject, OnInit, Output } from '@angular/core';
import { Device, Tag, TagType } from '../../../_models/device';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AbstractControl, UntypedFormBuilder, UntypedFormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-tag-property-edit-s7',
    templateUrl: './tag-property-edit-s7.component.html',
    styleUrls: ['./tag-property-edit-s7.component.scss']
})
export class TagPropertyEditS7Component implements OnInit {

    @Output() result = new EventEmitter<any>();
    formGroup: UntypedFormGroup;
    tagType = TagType;
    existingNames = [];
    error: string;

    constructor(private fb: UntypedFormBuilder,
        private translateService: TranslateService,
        public dialogRef: MatDialogRef<TagPropertyEditS7Component>,
        @Inject(MAT_DIALOG_DATA) public data: TagProperty) { }

    ngOnInit() {
        this.formGroup = this.fb.group({
            deviceName: [this.data.device.name, Validators.required],
            tagName: [this.data.tag.name, [Validators.required, this.validateName()]],
            tagType: [this.data.tag.type, Validators.required],
            tagAddress: [this.data.tag.address, Validators.required],
            tagDescription: [this.data.tag.description]
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
            this.error =  null;
            if (this.existingNames.indexOf(control.value) !== -1) {
                return { name: this.translateService.instant('msg.device-tag-exist')};
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

interface TagProperty {
    device: Device;
    tag: Tag;
}
