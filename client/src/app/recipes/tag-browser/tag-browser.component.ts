import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { ProjectService } from '../../_services/project.service';
import { Tag } from '../../_models/device';

@Component({
    selector: 'app-tag-browser',
    templateUrl: './tag-browser.component.html',
    styleUrls: ['./tag-browser.component.css']
})
export class TagBrowserComponent implements OnInit {
    devices: any[] = [];
    selectedDevice: any = null;
    tags: any[] = [];
    filterText = '';

    constructor(
        public dialogRef: MatDialogRef<TagBrowserComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any,
        private projectService: ProjectService
    ) {}

    ngOnInit() {
        this.devices = Object.values(this.projectService.getDevices() || {});
    }

    onDeviceSelect(device: any) {
        this.selectedDevice = device;
        this.tags = this.getDeviceTags(device);
        this.filterText = '';
    }

    getDeviceTags(device: any): any[] {
        const tags: any[] = [];
        if (device?.tags) {
            for (const key of Object.keys(device.tags)) {
                const tag = device.tags[key];
                tags.push({
                    id: tag.id,
                    name: tag.name,
                    type: tag.type || tag.tagType || 'number'
                });
            }
        }
        return tags;
    }

    getFilteredTags(): any[] {
        if (!this.filterText) return this.tags;
        const lower = this.filterText.toLowerCase();
        return this.tags.filter(t =>
            (t.name && t.name.toLowerCase().includes(lower)) ||
            (t.id && t.id.toLowerCase().includes(lower))
        );
    }

    onTagSelect(tag: any) {
        this.dialogRef.close({
            tagId: tag.id,
            tagName: tag.name,
            tagType: tag.type
        });
    }

    onCancel() {
        this.dialogRef.close();
    }
}
