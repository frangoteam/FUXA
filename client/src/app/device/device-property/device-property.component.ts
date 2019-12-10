import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

import { DeviceType } from './../../_models/device';
import { Utils } from '../../_helpers/utils';

@Component({
	selector: 'app-device-property',
	templateUrl: './device-property.component.html',
	styleUrls: ['./device-property.component.css']
})
export class DevicePropertyComponent implements OnInit {

	// @Input() name: any;
	deviceType: any = {};
	isFuxaServer: boolean = false;
	isToRemove: boolean = false;

	constructor(
		public dialogRef: MatDialogRef<DevicePropertyComponent>,
		@Inject(MAT_DIALOG_DATA) public data: any) { }

	ngOnInit() {
		this.isToRemove = this.data.remove;
		this.isFuxaServer = (this.data.device.type && this.data.device.type === DeviceType.FuxaServer) ? true : false;
		for (let key in DeviceType) {
			if (!this.isFuxaServer && key !== DeviceType.FuxaServer) {
				this.deviceType[key] = DeviceType[key];
			}
		}
	}

	onNoClick(): void {
		this.dialogRef.close();
	}

	onOkClick(): void {
	}

	isSiemensS7(type) {
		return (type === DeviceType.SiemensS7) ? true : false;
	}

	isValid(device): boolean {
        if (!device.name) {
            return false;
        }
		return (this.data.exist.find((n) => n === device.name)) ? false : true;
	}
}
