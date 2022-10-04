import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { TranslateService } from '@ngx-translate/core';
import { Device } from '../../../_models/device';
import { ProjectService } from '../../../_services/project.service';

@Component({
  selector: 'app-device-webapi-property-dialog',
  templateUrl: './device-webapi-property-dialog.component.html',
  styleUrls: ['./device-webapi-property-dialog.component.css']
})
export class DeviceWebapiPropertyDialogComponent implements OnInit {

    cacheDevice: Device;
	constructor(
		private projectService: ProjectService,
        private translateService: TranslateService,
		public dialogRef: MatDialogRef<DeviceWebapiPropertyDialogComponent>,
		@Inject(MAT_DIALOG_DATA) public data: any) { 
        }

    ngOnInit() {
        this.cacheDevice = JSON.parse(JSON.stringify(this.data.device));
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

    }
}
