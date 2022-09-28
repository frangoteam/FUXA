import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { Tag, TagDaq } from '../../_models/device';

@Component({
    selector: 'app-tag-options',
    templateUrl: './tag-options.component.html',
    styleUrls: ['./tag-options.component.css']
})
export class TagOptionsComponent implements OnInit {

    tagDaq = new TagDaq(false, true, 60);

    constructor(
        public dialogRef: MatDialogRef<TagOptionsComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any) {
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
                this.tagDaq.enabled = enabled.value;
            }
            if (changed.valid && changed.value !== null) {
                this.tagDaq.changed = changed.value;
            }
            if (interval.valid && interval.value !== null) {
                this.tagDaq.interval = interval.value;
            }
        }
    }

    ngOnInit() {
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.dialogRef.close(this.tagDaq);
    }
}
