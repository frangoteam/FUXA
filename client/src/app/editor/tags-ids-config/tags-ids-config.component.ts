import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Device } from '../../_models/device';

@Component({
    selector: 'app-tags-ids-config',
    templateUrl: './tags-ids-config.component.html',
    styleUrls: ['./tags-ids-config.component.scss']
})
export class TagsIdsConfigComponent {

    constructor(
        public dialogRef: MatDialogRef<TagsIdsConfigComponent>,
        @Inject(MAT_DIALOG_DATA) public data: TagsIdsData) {
    }

    onOkClick(): void {
        this.dialogRef.close(this.data.tagsIds);
    }

    onCancelClick(): void {
        this.dialogRef.close();
    }

    setVariable(tagIdRef: TagIdRef, event) {
        tagIdRef.destId = event.variableId;
    }
}

export interface TagsIdsData{
    devices: Device[];
    tagsIds: TagIdRef[];
}

export interface TagIdRef {
    srcId: string;
    destId: string;
}
