import { ChangeDetectionStrategy, Component, Inject, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FuxaServer, TagDaq, TagScale, TagScaleModeType } from '../../_models/device';

@Component({
    selector: 'app-tag-options',
    templateUrl: './tag-options.component.html',
    styleUrls: ['./tag-options.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TagOptionsComponent implements OnInit {

    formGroup: UntypedFormGroup;
    scaleModeType = TagScaleModeType;

    constructor(
        public dialogRef: MatDialogRef<TagOptionsComponent>,
        private fb: UntypedFormBuilder,
        @Inject(MAT_DIALOG_DATA) public data: any) {
    }

    ngOnInit() {
        this.formGroup = this.fb.group({
            interval: [{value: 60, disabled: true}, [Validators.required, Validators.min(1)]],
            changed: [{value: false, disabled: true}],
            enabled: [false],
            format: [null, [Validators.min(0)]],
            scaleMode: 'undefined',
            rawLow: null,
            rawHigh: null,
            scaledLow: null,
            scaledHigh: null,
            dateTimeFormat: null
        });

        this.formGroup.controls.enabled.valueChanges.subscribe(enabled => {
            if (enabled) {
                this.formGroup.controls.interval.enable();
                this.formGroup.controls.changed.enable();
            } else {
                this.formGroup.controls.interval.disable();
                this.formGroup.controls.changed.disable();
            }
        });

        // check if edit a group
        if (this.data.tags.length > 0) {
            let enabled = { value: null, valid: true };
            let changed = { value: null, valid: true };
            let interval = { value: null, valid: true };
            let format = { value: null, valid: true };
            let scaleMode = { value: null, valid: true };
            let rawLow = { value: null, valid: true };
            let rawHigh = { value: null, valid: true };
            let scaledLow = { value: null, valid: true };
            let scaledHigh = { value: null, valid: true };
            let dateTimeFormat = { value: null, valid: true };
            for (let i = 0; i < this.data.tags.length; i++) {
                if (!this.data.tags[i].daq) {
                    continue;
                }
                let daq = <TagDaq>this.data.tags[i].daq;
                if (!enabled.value) {
                    enabled.value = daq.enabled;
                } else if (enabled.value !== daq.enabled) {
                    enabled.valid = false;
                }
                if (!changed.value) {
                    changed.value = daq.changed;
                } else if (changed.value !== daq.changed) {
                    changed.valid = false;
                }
                if (!interval.value) {
                    interval.value = daq.interval;
                } else if (interval.value !== daq.interval) {
                    interval.valid = false;
                }
                if (!format.value) {
                    format.value = this.data.tags[i].format;
                } else if (format.value !== this.data.tags[i].format) {
                    format.valid = false;
                }
                if (!scaleMode.value) {
                    scaleMode.value = this.data.tags[i].scale?.mode;
                    rawLow.value = this.data.tags[i].scale?.rawLow;
                    rawHigh.value = this.data.tags[i].scale?.rawHigh;
                    scaledLow.value = this.data.tags[i].scale?.scaledLow;
                    scaledHigh.value = this.data.tags[i].scale?.scaledHigh;
                    dateTimeFormat.value = this.data.tags[i].scale?.dateTimeFormat;
                } else if (scaleMode.value !== this.data.tags[i].scale?.mode) {
                    scaleMode.valid = false;
                }

            }
            let values = {};
            if (enabled.valid && enabled.value !== null) {
                values = {...values, enabled: enabled.value};
            }
            if (changed.valid && changed.value !== null) {
                values = {...values, changed: changed.value};
            }
            if (interval.valid && interval.value) {
                values = {...values, interval: interval.value};
            }
            if (format.valid && format.value) {
                values = {...values, format: format.value};
            }
            if (scaleMode.valid && scaleMode.value) {
                values = {...values,
                    scaleMode: scaleMode.value,
                    rawLow: rawLow.value,
                    rawHigh: rawHigh.value,
                    scaledLow: scaledLow.value,
                    scaledHigh: scaledHigh.value,
                    dateTimeFormat: dateTimeFormat.value
                };
            }
            this.formGroup.patchValue(values);
            if (this.data.device?.id === FuxaServer.id) {
                this.formGroup.controls.scaleMode.disable();
            }
            this.formGroup.updateValueAndValidity();
            this.onCheckScaleMode(this.formGroup.value.scaleMode);
        }

        this.formGroup.controls.scaleMode.valueChanges.subscribe(value => {
            this.onCheckScaleMode(value);
        });
    }

    onCheckScaleMode(value: string) {
        switch (value) {
            case 'undefined':
            this.formGroup.controls.rawLow.clearValidators();
            this.formGroup.controls.rawHigh.clearValidators();
            this.formGroup.controls.scaledLow.clearValidators();
            this.formGroup.controls.scaledHigh.clearValidators();
            break;
            case 'linear':
            this.formGroup.controls.rawLow.setValidators(Validators.required);
            this.formGroup.controls.rawHigh.setValidators(Validators.required);
            this.formGroup.controls.scaledLow.setValidators(Validators.required);
            this.formGroup.controls.scaledHigh.setValidators(Validators.required);
            break;
        }
        this.formGroup.updateValueAndValidity();
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.dialogRef.close({
            daq: new TagDaq(
                this.formGroup.value.enabled,
                this.formGroup.value.changed,
                this.formGroup.value.interval
            ),
            format: this.formGroup.value.format,
            scale: (this.formGroup.value.scaleMode !== 'undefined') ? {
                mode: this.formGroup.value.scaleMode,
                rawLow: this.formGroup.value.rawLow,
                rawHigh: this.formGroup.value.rawHigh,
                scaledLow: this.formGroup.value.scaledLow,
                scaledHigh: this.formGroup.value.scaledHigh,
                dateTimeFormat: this.formGroup.value.dateTimeFormat
            } : null,
        });
    }
}

export interface ITagOption {
    daq: TagDaq;
    format: number;
    scale: TagScale;
}
