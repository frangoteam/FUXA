import { Component, EventEmitter, Inject, OnDestroy, OnInit, Output } from '@angular/core';
import { HmiService } from '../../../../_services/hmi.service';
import { Subject, takeUntil } from 'rxjs';
import { MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';
import { Device } from '../../../../_models/device';

@Component({
    selector: 'app-tag-property-redis-scan',
    templateUrl: './tag-property-redis-scan.component.html',
    styleUrls: ['./tag-property-redis-scan.component.scss']
})
export class TagPropertyRedisScanComponent implements OnInit, OnDestroy {

    @Output() result = new EventEmitter<TagPropertyRedisData>();
    private destroy$ = new Subject<void>();

    constructor(
        private hmiService: HmiService,
        @Inject(MAT_DIALOG_DATA) public data: TagPropertyRedisData
    ) { }

    ngOnInit() {
        this.hmiService.onDeviceBrowse.pipe(
            takeUntil(this.destroy$),
        ).subscribe(res => {
            if (res.result) {
                // this.addTreeNodes(res.result);
                // this.treetable.update(false);
            }
        });
        this.hmiService.askDeviceBrowse(this.data.device.id);
    }

    ngOnDestroy() {
        this.destroy$.next(null);
        this.destroy$.complete();
    }

    onNoClick(): void {
        this.result.emit();
    }
}

export interface TagPropertyRedisData {
    device: Device;
    nodes?: Node[];
}
