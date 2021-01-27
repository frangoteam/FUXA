import { Component, OnInit, Inject, OnDestroy, ViewChild } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatExpansionPanel } from '@angular/material';
import { Subscription } from "rxjs";
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

	pollingPlcType = [{text: '200 ms', value: 200}, {text: '500 ms', value: 500}, {text: '700 ms', value: 700}, {text: '1 sec', value: 1000}, 
					{text: '1.5 sec', value: 1500}, {text: '2 sec', value: 2000}, { text: '3 sec', value: 3000}, 
					{text: '4 sec', value: 4000}, {text: '5 sec', value: 5000}];
	pollingWebApiType = [{text: '1 sec', value: 1000}, {text: '2 sec', value: 2000}, {text: '3 sec', value: 3000}, { text: '5 sec', value: 5000}, 
						{text: '10 sec', value: 10000}, {text: '30 sec', value: 30000}, {text: '1 min', value: 60000}, {text: '2 min', value: 60000 * 2},
						{text: '5 min', value: 60000 * 5}, {text: '10 min', value: 60000 * 10}, {text: '30 min', value: 60000 * 30}, {text: '60 min', value: 60000 * 60}];

	pollingType = this.pollingPlcType;

	isFuxaServer: boolean = false;
	isToRemove: boolean = false;
	propertyExpanded: boolean;
	propertyLoading: boolean;
	securityMode: any = [];
	security = new DeviceSecurity();
	baudrateType = [110, 300, 600, 1200, 2400, 4800, 9600, 14400, 19200, 28800, 38400, 57600, 115200, 128000, 256000, 921600 ];
	databitsType = [7, 8];
	stopbitsType = [1, 1.5, 2];
	parityType = ['None', 'Odd', 'Even'];
	methodType = ['GET'];//, 'POST'];
	parserType = ['JSON'];//, 'CSV'];
	hostInterfaces = [];
	result = '';
	private subscriptionDeviceProperty: Subscription;
	private subscriptionHostInterfaces: Subscription;
	private subscriptionDeviceWebApiRequest: Subscription;

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
				for (let idx = 0; idx < this.data.availableType.length; idx++) {
					if (key.startsWith(this.data.availableType[idx])) {
						this.deviceType[key] = DeviceType[key];
					}
				}
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
						} else if (sec.securityPolicy.indexOf(secPol.Basic128Rsa15) !== -1) {
							this.securityMode.push({value: sec, text: SecurityPolicy.Basic128Rsa15.toString() + ' - ' + mode});
						} else if (sec.securityPolicy.indexOf(secPol.Basic128) !== -1) {
							this.securityMode.push({value: sec, text: SecurityPolicy.Basic128.toString() + ' - ' + mode});
						} else if (sec.securityPolicy.indexOf(secPol.Basic192Rsa15) !== -1) {							
							this.securityMode.push({value: sec, text: SecurityPolicy.Basic192Rsa15.toString() + ' - ' + mode});
						} else if (sec.securityPolicy.indexOf(secPol.Basic192) !== -1) {
							this.securityMode.push({value: sec, text: SecurityPolicy.Basic192.toString() + ' - ' + mode});
						} else if (sec.securityPolicy.indexOf(secPol.Basic256Rsa15) !== -1) {
							this.securityMode.push({value: sec, text: SecurityPolicy.Basic256Rsa15.toString() + ' - ' + mode});
						} else if (sec.securityPolicy.indexOf(secPol.Basic256Sha256) !== -1) {
							this.securityMode.push({value: sec, text: SecurityPolicy.Basic256Sha256.toString() + ' - ' + mode});
						} else if (sec.securityPolicy.indexOf(secPol.Basic256) !== -1) {
							this.securityMode.push({value: sec, text: SecurityPolicy.Basic256.toString() + ' - ' + mode});
						} else if (sec.securityPolicy.indexOf(secPol.Aes128_Sha256_RsaOaep) !== -1) {
							this.securityMode.push({value: sec, text: SecurityPolicy.Aes128_Sha256_RsaOaep.toString() + ' - ' + mode});
						} else if (sec.securityPolicy.indexOf(secPol.Aes256_Sha256_RsaPss) !== -1) {
							this.securityMode.push({value: sec, text: SecurityPolicy.Aes256_Sha256_RsaPss.toString() + ' - ' + mode});
						}
						if (this.isSecurityMode(sec)) {
							this.securityRadio = sec;
						}
					}
				} else if (res.error) {

				}
			} else if (res.type === DeviceType.BACnet) {
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
		if (!this.data.device.property.baudrate) {
			this.data.device.property.baudrate = 9600;
		}
		if (!this.data.device.property.databits) {
			this.data.device.property.databits = 8;
		}
		if (!this.data.device.property.stopbits) {
			this.data.device.property.stopbits = 1;
		}
		if (!this.data.device.property.parity) {
			this.data.device.property.parity = 'None';
		}
		this.subscriptionHostInterfaces = this.hmiService.onHostInterfaces.subscribe(res => {
			if (res.result) {
				this.hostInterfaces = res;
			}
		});
		this.subscriptionDeviceWebApiRequest = this.hmiService.onDeviceWebApiRequest.subscribe(res => {
			console.log(res);
			if (res.result) {
				this.result = JSON.stringify(res.result);
			}
			this.propertyLoading = false;
		});

		this.onDeviceTypeChanged();
		// this.hmiService.askHostInterface();
	}

	ngOnDestroy() {
		try {
			if (this.subscriptionDeviceProperty) {
				this.subscriptionDeviceProperty.unsubscribe();
			}
			if (this.subscriptionHostInterfaces) {
				this.subscriptionHostInterfaces.unsubscribe();
			}
			if (this.subscriptionDeviceWebApiRequest) {
				this.subscriptionDeviceWebApiRequest.unsubscribe();
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

	onCheckWebApi() {
		this.propertyLoading = true;
		this.result = '';
		this.hmiService.askWebApiProperty(this.data.device.property);
	}

	// onCheckBACnetDevice() {
	// 	this.propertyLoading = true;
	// 	this.hmiService.askDeviceProperty(this.data.device.property.address, this.data.device.type);
	// }

	onPropertyExpand(status) {
		this.propertyExpanded = status;
	}

	onAddressChanged() {
		this.propertyLoading = false;
	}

	onDeviceTypeChanged() {
		if (this.data.device.type === DeviceType.WebAPI) {
			this.pollingType = this.pollingWebApiType;
		} else {
			this.pollingType = this.pollingPlcType;
		}
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
