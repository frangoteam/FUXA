import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { Device } from '../../../_models/device';
import { HmiService } from '../../../_services/hmi.service';
import { ProjectService } from '../../../_services/project.service';

@Component({
  selector: 'app-device-webapi-property-dialog',
  templateUrl: './device-webapi-property-dialog.component.html',
  styleUrls: ['./device-webapi-property-dialog.component.css']
})
export class DeviceWebapiPropertyDialogComponent implements OnInit, OnDestroy {

    private cacheDevice: Device;
	private subscriptionDeviceTagsRequest: Subscription;

    message = '';

	constructor(
		private projectService: ProjectService,
        private hmiService: HmiService,
        private translateService: TranslateService,
		public dialogRef: MatDialogRef<DeviceWebapiPropertyDialogComponent>,
		@Inject(MAT_DIALOG_DATA) public data: IDataDevice) {
        }

    ngOnInit() {
        this.cacheDevice = JSON.parse(JSON.stringify(this.data.device));

        this.subscriptionDeviceTagsRequest = this.hmiService.onDeviceTagsRequest.subscribe(res => {
			if (res.result && res.result.tags) {
                this.translateService.get('msg.device-tags-request-result', { value: res.result.newTagsCount, current: res.result.tags.length }).subscribe((txt: string) => { this.message = txt; });
                if (res.result.newTagsCount) {
                    for (let i = 0; i < res.result.tags.length; i++) {
                        this.data.device.tags[res.result.tags[i][0].id] = res.result.tags[i][0];
                    }
                    this.projectService.setDevice(this.data.device, this.data.device, null);
                }
            }
		});
    }

    ngOnDestroy() {
		try {
			if (this.subscriptionDeviceTagsRequest) {
				this.subscriptionDeviceTagsRequest.unsubscribe();
			}
		} catch (err) {
            console.error(err);
		}
	}

    onNoClick(): void {
		this.dialogRef.close();
	}

    onOkClick(): void {
        if (this.cacheDevice.enabled !== this.data.device.enabled) {
            this.projectService.setDevice(this.data.device, this.data.device, null);
        }
		this.dialogRef.close();
    }

    onLoadTagsClick(): void {
        this.message = '';
		this.hmiService.askDeviceTags(this.data.device.id);
    }
}

export interface IDataDevice {
    device: Device;
}
