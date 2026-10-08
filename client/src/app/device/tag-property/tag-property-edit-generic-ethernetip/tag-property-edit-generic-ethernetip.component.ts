import { Component, EventEmitter, Inject, OnDestroy, OnInit, Output } from '@angular/core';
import { AbstractControl, UntypedFormBuilder, UntypedFormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { Device, EnipTypes, Tag } from '../../../_models/device';
import { HmiService } from '../../../_services/hmi.service';

@Component({
    selector: 'app-tag-property-edit-generic-ethernetip',
    templateUrl: './tag-property-edit-generic-ethernetip.component.html',
    styleUrls: ['./tag-property-edit-generic-ethernetip.component.scss']
})
export class TagPropertyEditGenericEthernetIPComponent implements OnInit, OnDestroy {
    @Output() result = new EventEmitter<any>();
    formGroup: UntypedFormGroup;
    availableTags: any[] = [];
    browseError = '';
    dataTypes = [
        { name: 'BOOL', value: EnipTypes.BOOL },
        { name: 'SINT', value: EnipTypes.SINT },
        { name: 'INT', value: EnipTypes.INT },
        { name: 'DINT', value: EnipTypes.DINT },
        { name: 'LINT', value: EnipTypes.LINT },
        { name: 'USINT', value: EnipTypes.USINT },
        { name: 'UINT', value: EnipTypes.UINT },
        { name: 'UDINT', value: EnipTypes.UDINT },
        { name: 'REAL', value: EnipTypes.REAL },
        { name: 'LREAL', value: EnipTypes.LREAL },
        { name: 'STRING', value: EnipTypes.STRING },
        { name: 'SHORT_STRING', value: EnipTypes.SHORT_STRING }
    ];
    private destroy$ = new Subject<void>();

    constructor(private fb: UntypedFormBuilder,
        private translateService: TranslateService,
        private hmiService: HmiService,
        public dialogRef: MatDialogRef<TagPropertyEditGenericEthernetIPComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { device: Device; tag: Tag }) { }

    ngOnInit() {
        const symbolic = this.data.tag.enipOptions?.symbolicOpt || {};
        this.formGroup = this.fb.group({
            name: [this.data.tag.name, [Validators.required, this.validateName()]],
            address: [this.data.tag.address, Validators.required],
            program: [symbolic.program || ''],
            dataType: [symbolic.dataType ?? null],
            description: [this.data.tag.description || '']
        });
        this.hmiService.onDeviceBrowse.pipe(takeUntil(this.destroy$)).subscribe(message => {
            if (message?.device !== this.data.device.id) {
                return;
            }
            if (message.error) {
                this.browseError = typeof message.error === 'string' ? message.error : message.error.message;
                this.availableTags = [];
            } else if (message.result?.tags) {
                this.availableTags = message.result.tags;
                this.browseError = '';
            }
        });
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    validateName(): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            const name = control.value;
            const exists = Object.values(this.data.device.tags || {}).some(tag =>
                tag.id !== this.data.tag.id && tag.name === name);
            if (exists) {
                return { name: this.translateService.instant('msg.device-tag-exist') };
            }
            if (name?.includes('@')) {
                return { name: this.translateService.instant('msg.device-tag-invalid-char') };
            }
            return null;
        };
    }

    onNoClick() {
        this.result.emit();
    }

    onOkClick() {
        this.result.emit(this.formGroup.getRawValue());
    }

    browseTags() {
        this.browseError = '';
        this.hmiService.askDeviceBrowse(this.data.device.id);
    }

    selectTag(tag: any) {
        this.formGroup.patchValue({
            address: tag.name,
            program: tag.program || '',
            dataType: tag.type?.code ?? null
        });
    }
}
