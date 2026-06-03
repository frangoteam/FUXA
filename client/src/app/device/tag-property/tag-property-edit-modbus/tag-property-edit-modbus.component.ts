import { Component, EventEmitter, OnInit, Inject, Output, OnDestroy } from '@angular/core';
import { Device, ModbusTagType, Tag } from '../../../_models/device';
import { AbstractControl, UntypedFormBuilder, UntypedFormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA as MAT_DIALOG_DATA, MatDialogRef as MatDialogRef } from '@angular/material/dialog';
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
    tagTypeHint: Record<string, string> = {
        Bool:     'Bool',
        Int16:    '16bit INT, Byte order 1,2',        UInt16:    '16bit UINT, Byte order 1,2',
        Int16LE:  '16bit INT, Byte order 2,1',        UInt16LE:  '16bit UINT, Byte order 2,1',
        Int32:    '32bit INT, Byte order 1,2,3,4',    UInt32:    '32bit UINT, Byte order 1,2,3,4',
        Int32LE:  '32bit INT, Byte order 4,3,2,1',    UInt32LE:  '32bit UINT, Byte order 4,3,2,1',
        Int32MLE: '32bit INT, Byte order 2,1,4,3',    UInt32MLE: '32bit UINT, Byte order 2,1,4,3',
        Float32:    '32bit Float, Byte order 1,2,3,4',
        Float32LE:  '32bit Float, Byte order 4,3,2,1',
        Float32MLE: '32bit Float, Byte order 2,1,4,3',
        Float64:    '64bit Double, Byte order 1,2,3,4,5,6,7,8',
        Float64LE:  '64bit Double, Byte order 8,7,6,5,4,3,2,1',
        Float64MLE: '64bit Double, Byte order 2,1,4,3,6,5,8,7',
        Int64:    '64bit INT, Byte order 1,2,3,4,5,6,7,8',    UInt64:    '64bit UINT, Byte order 1,2,3,4,5,6,7,8',
        Int64LE:  '64bit INT, Byte order 8,7,6,5,4,3,2,1',    UInt64LE:  '64bit UINT, Byte order 8,7,6,5,4,3,2,1',
        Int64MLE: '64bit INT, Byte order 2,1,4,3,6,5,8,7',    UInt64MLE: '64bit UINT, Byte order 2,1,4,3,6,5,8,7',
        Int64MBE: '64bit INT, Byte order 5,6,7,8,1,2,3,4',    UInt64MBE: '64bit UINT, Byte order 5,6,7,8,1,2,3,4',
    };
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
