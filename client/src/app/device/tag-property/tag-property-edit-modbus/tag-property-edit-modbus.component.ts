import { Component, EventEmitter, OnInit, Inject, Output, OnDestroy } from '@angular/core';
import { Device, ModbusTagType, Tag } from '../../../_models/device';
import { AbstractControl, UntypedFormBuilder, UntypedFormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'app-tag-property-edit-modbus',
    templateUrl: './tag-property-edit-modbus.component.html',
    styleUrls: ['./tag-property-edit-modbus.component.scss']
})
export class TagPropertyEditModbusComponent implements OnInit, OnDestroy {
    @Output() result = new EventEmitter<any>();
    formGroup: UntypedFormGroup;
    tagType = ModbusTagType;
    memAddress = {
        'Coil Status (Read/Write 000001-065536)': '000000',
        'Digital Inputs (Read 100001-165536)': '100000',
        'Input Registers (Read  300001-365536)': '300000',
        'Holding Registers (Read/Write  400001-465535)': '400000'
    };
    existingNames = [];
    error: string;
    private destroy$ = new Subject<void>();

    constructor(private fb: UntypedFormBuilder,
        private translateService: TranslateService,
        public dialogRef: MatDialogRef<TagPropertyEditModbusComponent>,
        @Inject(MAT_DIALOG_DATA) public data: TagProperty) { }

    ngOnInit() {
        this.formGroup = this.fb.group({
            deviceName: [this.data.device.name, Validators.required],
            tagName: [this.data.tag.name, [Validators.required, this.validateName()]],
            tagType: [this.data.tag.type, Validators.required],
            tagAddress: [this.data.tag.address, [Validators.required, Validators.min(0)]],
            tagMemoryAddress: [this.data.tag.memaddress, Validators.required],
            tagDescription: [this.data.tag.description],
            tagDivisor: [this.data.tag.divisor]
        });
        this.formGroup.controls.tagMemoryAddress.valueChanges.pipe(
            takeUntil(this.destroy$)
        ).subscribe(memaddress => {
            this.formGroup.controls.tagType.enable();
            if (!memaddress) {
                this.formGroup.controls.tagType.disable();
            } else if (memaddress === '000000' || memaddress === '100000') {
                this.formGroup.patchValue({
                    tagType: ModbusTagType.Bool
                });
                this.formGroup.controls.tagType.disable();
            }
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
        this.destroy$.next();
        this.destroy$.complete();
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

interface TagProperty {
    device: Device;
    tag: Tag;
}
