import { Component, OnInit, Inject, OnDestroy, ViewChild } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatExpansionPanel } from '@angular/material';
import { Subscription } from "rxjs/Subscription";
import { TranslateService } from '@ngx-translate/core';

import { HmiService } from '../../_services/hmi.service';
import { ProjectService } from '../../_services/project.service';
import { DeviceType, DeviceSecurity, MessageSecurityMode, SecurityPolicy } from './../../_models/device';
import { Utils } from '../../_helpers/utils';

@Component({
	selector: 'app-device-property',
	templateUrl: './device-property.component.html',
	styleUrls: ['./device-property.component.css']
})
export class DevicePropertyComponent implements OnInit, OnDestroy {

	// @Input() name: any;
	@ViewChild(MatExpansionPanel) panelProperty: MatExpansionPanel;
	securityRadio: any;
	mode: any;
	deviceType: any = {};
	isFuxaServer: boolean = false;
	isToRemove: boolean = false;
	propertyExpanded: boolean;
	propertyLoading: boolean;
	securityMode: any = [];
	security = new DeviceSecurity();
	private subscriptionDeviceProperty: Subscription;

	constructor(
		private hmiService: HmiService,
		private projectService: ProjectService,
        private translateService: TranslateService,
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

		this.subscriptionDeviceProperty = this.hmiService.onDeviceProperty.subscribe(res => {
			if (res.type === DeviceType.OPCUA) {
				this.securityMode = [];
				if (res.result) {
					let secPol = SecurityPolicy;
					for (let idx = 0; idx < res.result.length; idx++) {
						let sec = res.result[idx];
						let mode = this.securityModeToString(sec.securityMode);
						if (sec.securityPolicy.indexOf(secPol.None) !== -1) {
							this.securityMode.push({value: sec, text: SecurityPolicy.None.toString() + ' - ' + mode});
						} else if (sec.securityPolicy.indexOf(secPol.Basic128) !== -1) {
							this.securityMode.push({value: sec, text: SecurityPolicy.Basic128.toString() + ' - ' + mode});
						} else if (sec.securityPolicy.indexOf(secPol.Basic128Rsa15) !== -1) {
							this.securityMode.push({value: sec, text: SecurityPolicy.Basic128Rsa15.toString() + ' - ' + mode});
						} else if (sec.securityPolicy.indexOf(secPol.Basic192) !== -1) {
							this.securityMode.push({value: sec, text: SecurityPolicy.Basic192.toString() + ' - ' + mode});
						} else if (sec.securityPolicy.indexOf(secPol.Basic192Rsa15) !== -1) {
							this.securityMode.push({value: sec, text: SecurityPolicy.Basic192Rsa15.toString() + ' - ' + mode});
						} else if (sec.securityPolicy.indexOf(secPol.Basic256) !== -1) {
							this.securityMode.push({value: sec, text: SecurityPolicy.Basic256.toString() + ' - ' + mode});
						} else if (sec.securityPolicy.indexOf(secPol.Basic256Rsa15) !== -1) {
							this.securityMode.push({value: sec, text: SecurityPolicy.Basic256Rsa15.toString() + ' - ' + mode});
						} else if (sec.securityPolicy.indexOf(secPol.Basic256Sha256) !== -1) {
							this.securityMode.push({value: sec, text: SecurityPolicy.Basic256Sha256.toString() + ' - ' + mode});
						}
						if (this.isSecurityMode(sec)) {
							this.securityRadio = sec;
						}
					}
				} else if (res.error) {

				}
			}
			this.propertyLoading = false;
		});		
		// check security
		if (this.data.device.name && this.data.device.type === DeviceType.OPCUA) {
			this.projectService.getDeviceSecurity(this.data.device.name).subscribe(result => {
				this.setSecurity(result.value);
			}, err => {
				console.log('get Device Security err: ' + err);
			});
		}
	}

	ngOnDestroy() {
		try {
			if (this.subscriptionDeviceProperty) {
				this.subscriptionDeviceProperty.unsubscribe();
			}
		} catch (e) {
		}
	}

	onNoClick(): void {
		this.dialogRef.close();
	}

	onOkClick(): void {
		this.data.security = this.getSecurity();
	}

	onCheckOpcUaServer() {
		this.propertyLoading = true;
		this.hmiService.askDeviceProperty(this.data.device.property.address, this.data.device.type);
	}

	onPropertyExpand(status) {
		this.propertyExpanded = status;
	}

	onAddressChanged() {
		this.propertyLoading = false;
	}

	isSiemensS7(type) {
		return (type === DeviceType.SiemensS7) ? true : false;
	}

	isOpcUa(type) {
		return (type === DeviceType.OPCUA) ? true : false;
	}

	isValid(device): boolean {
        if (!device.name) {
            return false;
        }
		return (this.data.exist.find((n) => n === device.name)) ? false : true;
	}

	isSecurityMode(sec) {
		if (JSON.stringify(this.mode) === JSON.stringify(sec)) {
			return true;
		} else {
			return false;
		}
	}

	getSecurity(): any {
		if (this.data.device.type !== DeviceType.OPCUA || !this.propertyExpanded) {
			return null;
		} else {
			if (this.securityRadio || this.security.username || this.security.password) {
				let result = { mode: this.securityRadio, uid: this.security.username, pwd: this.security.password };
				return result;
			} else {
				return null;
			}
		}
	}

	setSecurity(security: string) {
		if (security && security !== 'null') {
			let value = JSON.parse(security);
			this.mode = value.mode;
			this.security.username = value.uid;
			this.security.password = value.pwd;
			this.panelProperty.open();
		}
	}

	private securityModeToString(mode): string {
		let secMode = MessageSecurityMode;
		let result = '';
		if (mode === secMode.NONE) {
			this.translateService.get('device.security-none').subscribe((txt: string) => { result = txt });
		} else if (mode === secMode.SIGN) {
			this.translateService.get('device.security-sign').subscribe((txt: string) => { result = txt });
		} else if (mode === secMode.SIGNANDENCRYPT) {
			this.translateService.get('device.security-signandencrypt').subscribe((txt: string) => { result = txt });
		} 
		return result;
	}
}
