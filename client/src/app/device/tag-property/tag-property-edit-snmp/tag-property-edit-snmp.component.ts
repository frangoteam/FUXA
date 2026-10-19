import { Component, EventEmitter, Inject, OnDestroy, OnInit, Output } from '@angular/core';
import { AbstractControl, UntypedFormBuilder, UntypedFormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { Device, SnmpTagType, Tag } from '../../../_models/device';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
    selector: 'app-tag-property-edit-snmp',
    templateUrl: './tag-property-edit-snmp.component.html',
    styleUrls: ['./tag-property-edit-snmp.component.scss']
})
export class TagPropertyEditSnmpComponent implements OnInit, OnDestroy {
    @Output() result = new EventEmitter<any>();
    formGroup: UntypedFormGroup;
    tagType = SnmpTagType;
    existingNames = [];
    error: string;
    private destroy$ = new Subject<void>();

    /** numeric OID or MIB name 'MODULE::name.instance' resolved by the server */
    static readonly OID_REGEX = /^(\.?\d+(\.\d+)+|([A-Za-z][\w-]*::)[A-Za-z][\w-]*(\.\d+)*)$/;

    constructor(private fb: UntypedFormBuilder,
        private translateService: TranslateService,
        public dialogRef: MatDialogRef<TagPropertyEditSnmpComponent>,
        @Inject(MAT_DIALOG_DATA) public data: TagPropertySnmpData) { }

    ngOnInit() {
        this.formGroup = this.fb.group({
            deviceName: [this.data.device.name, Validators.required],
            tagName: [this.data.tag.name, [Validators.required, this.validateName()]],
            tagType: [this.data.tag.type || SnmpTagType.Integer, Validators.required],
            tagAddress: [this.data.tag.address, [Validators.required, this.validateOid()]],
            tagDescription: [this.data.tag.description],
            trapOnly: [!!this.data.tag.options?.trapOnly],
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

    ngOnDestroy() {
        this.destroy$.next(null);
        this.destroy$.complete();
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

    validateOid(): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            const oid = control?.value?.trim();
            if (oid && !TagPropertyEditSnmpComponent.OID_REGEX.test(oid)) {
                return { oid: this.translateService.instant('msg.device-tag-snmp-oid-invalid') };
            }
            return null;
        };
    }

    onNoClick(): void {
        this.result.emit();
    }

    onOkClick(): void {
        const result = this.formGroup.getRawValue();
        result.tagAddress = result.tagAddress?.trim();
        this.result.emit(result);
    }
}

export interface TagPropertySnmpData {
    device: Device;
    tag: Tag;
}
