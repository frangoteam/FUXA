import { Component, OnInit, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TagDaq } from '../../_models/device';

@Component({
    selector: 'app-tag-options',
    templateUrl: './tag-options.component.html',
    styleUrls: ['./tag-options.component.css']
})
export class TagOptionsComponent {

    formGroup: FormGroup;

    constructor(
        public dialogRef: MatDialogRef<TagOptionsComponent>,
        private fb: FormBuilder,
        @Inject(MAT_DIALOG_DATA) public data: any) {

        this.formGroup = this.fb.group({
            interval: [{value: 60, disabled: true}, [Validators.required, Validators.min(1)]],
            changed: [{value: false, disabled: true}],
            enabled: [false],
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
            }
            if (enabled.valid && enabled.value !== null) {
                this.formGroup.patchValue({enabled: enabled.value});
            }
            if (changed.valid && changed.value !== null) {
                this.formGroup.patchValue({changed: changed.value});
            }
            if (interval.valid && interval.value) {
                this.formGroup.patchValue({interval: interval.value});
            }
        }
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.dialogRef.close(new TagDaq(
            this.formGroup.value.enabled,
            this.formGroup.value.changed,
            this.formGroup.value.interval
        ));

    }
}
