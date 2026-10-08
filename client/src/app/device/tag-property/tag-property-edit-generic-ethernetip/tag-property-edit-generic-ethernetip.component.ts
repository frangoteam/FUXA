import { Component, EventEmitter, Inject, OnDestroy, OnInit, Output } from '@angular/core';
import { AbstractControl, UntypedFormBuilder, UntypedFormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { Device, EnipIODataType, EnipTagDataSourceType, EnipTagOptions, EnipTypes, EthernetIPModule, Tag } from '../../../_models/device';
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
    readonly EnipTagDataSourceType = EnipTagDataSourceType;
    readonly EnipIODataType = EnipIODataType;
    tagSources = [
        { name: 'device.enip-tag-type-symbolic', value: EnipTagDataSourceType.symbolic },
        { name: 'device.enip-tag-type-explicit', value: EnipTagDataSourceType.explicit },
        { name: 'device.enip-tag-type-io', value: EnipTagDataSourceType.assemblyIO }
    ];
    ioTypes = [
        { name: 'device.enip-io-bit', value: EnipIODataType.bit },
        { name: 'device.enip-io-integer16', value: EnipIODataType.integer16 }
    ];
    ioDirections = [
        { name: 'device.enip-io-input', value: false },
        { name: 'device.enip-io-output', value: true }
    ];
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
        const options: EnipTagOptions = this.data.tag.enipOptions || {
            tagType: EnipTagDataSourceType.symbolic
        };
        const symbolic = this.data.tag.enipOptions?.symbolicOpt || {};
        const explicit = options.explicitOpt || {};
        const io = options.ioOpt || {};
        this.formGroup = this.fb.group({
            name: [this.data.tag.name, [Validators.required, this.validateName()]],
            tagType: [options.tagType ?? EnipTagDataSourceType.symbolic, Validators.required],
            address: [this.data.tag.address, Validators.required],
            program: [symbolic.program || ''],
            dataType: [symbolic.dataType ?? null],
            explicitClass: [explicit.class ?? null],
            explicitInstance: [explicit.instance ?? null],
            explicitAttribute: [explicit.attribute ?? null],
            explicitGetOrSend: [explicit.getOrSend ?? true],
            explicitSendBuffer: [explicit.sendBuffer || ''],
            ioModuleId: [io.ioModuleId || ''],
            ioType: [io.ioType ?? EnipIODataType.bit],
            ioByteOffset: [io.ioByteOffset ?? 0],
            ioBitOffset: [io.ioBitOffset ?? 0],
            ioOutput: [io.ioOutput ?? false],
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

    isSymbolic() {
        return this.formGroup?.get('tagType')?.value === EnipTagDataSourceType.symbolic;
    }

    isExplicit() {
        return this.formGroup?.get('tagType')?.value === EnipTagDataSourceType.explicit;
    }

    isAssemblyIO() {
        return this.formGroup?.get('tagType')?.value === EnipTagDataSourceType.assemblyIO;
    }

    isBitIO() {
        return this.formGroup?.get('ioType')?.value === EnipIODataType.bit;
    }

    isValid() {
        if (!this.formGroup || this.formGroup.get('name')?.invalid) {
            return false;
        }
        const value = this.formGroup.getRawValue();
        if (this.isSymbolic()) {
            return !!value.address;
        }
        if (this.isExplicit()) {
            return [value.explicitClass, value.explicitInstance, value.explicitAttribute]
                .every(item => item !== null && item !== '' && Number.isFinite(Number(item)));
        }
        if (this.isAssemblyIO()) {
            return !!value.ioModuleId && Number.isFinite(Number(value.ioByteOffset)) &&
                Number(value.ioByteOffset) >= 0 && (!this.isBitIO() ||
                    (Number.isFinite(Number(value.ioBitOffset)) && Number(value.ioBitOffset) >= 0 && Number(value.ioBitOffset) <= 7));
        }
        return false;
    }

    ethernetIpModules(): EthernetIPModule[] {
        return Object.values(this.data.device.modules || {});
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
