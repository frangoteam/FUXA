import { Component, OnInit, OnDestroy, AfterViewInit, Output, EventEmitter } from '@angular/core';
import { Subscription } from "rxjs";
import { MatDialog } from '@angular/material';

import { DevicePropertyComponent } from './../device-property/device-property.component';
import { ProjectService } from '../../_services/project.service';
import { PluginService } from '../../_services/plugin.service';
import { Device, DeviceType, DeviceNetProperty } from './../../_models/device';
import { Utils } from '../../_helpers/utils';
import { Plugin } from '../../_models/plugin';

@Component({
	selector: 'app-device-map',
	templateUrl: './device-map.component.html',
	styleUrls: ['./device-map.component.scss']
})
export class DeviceMapComponent implements OnInit, OnDestroy, AfterViewInit {

	@Output() goto: EventEmitter<Device> = new EventEmitter();
	private subscriptionPluginsChange: Subscription;


	flowBorder = 5;
	flowWidth = 160;
	flowHeight = 70;
	flowLineHeight = 60;

	deviceBorder = 5;
	deviceWidth = 160;
	deviceHeight = 90;
	deviceLineHeight = 60;

	lineFlowSize = 6;
	lineFlowHeight = 60;
	lineDeviceSize = 6;
	mainDeviceLineHeight = 60;
	mainWidth = 160;
	mainHeight = 90;
	mainBorder = 5;

	server: Device;
	devices = {};
    plugins = [];

	devicesStatus = {};
	dirty: boolean = false;

	constructor(private dialog: MatDialog,
        private pluginService: PluginService,
		private projectService: ProjectService) { }

	ngOnInit() {
		this.loadCurrentProject();
		this.loadAvailableType();
		this.subscriptionPluginsChange = this.pluginService.onPluginsChanged.subscribe(event => {
			this.loadAvailableType();
		});
	}

	ngAfterViewInit() {
	}

	ngOnDestroy() {
		try {
			if (this.subscriptionPluginsChange) {
				this.subscriptionPluginsChange.unsubscribe();
			}
		} catch (e) {
		}
	}

	onEditDevice(device: Device) {
		this.editDevice(device, false);
	}

	loadCurrentProject() {
		// take the copy of devices to save by leave
		let prj = this.projectService.getProject();
		if (prj && prj.server) {
			this.server = prj.server;
		}
		if (prj && prj.devices) {
			this.devices = prj.devices;
		}
	}

	checkLayout() {
		if (this.devices)
		{
			if (this.plcs().length && this.flows().length) {

			}
		}
	}

	loadAvailableType() {
		// define available device type (plugins)
		this.plugins = [];
		this.pluginService.getPlugins().subscribe(plugins => {
			Object.values(plugins).forEach((pg) => {
				if (pg.current.length) {
					this.plugins.push(pg.type);
				}
			});
        }, error => {
		});
		this.plugins.push(DeviceType.WebAPI);
	}

	addDevice() {
		let device = new Device();
		device.id = Utils.getGUID();
		device.property = new DeviceNetProperty();
		device.enabled = false;
		device.tags = {};
		this.editDevice(device, false);
	}

	onRemoveDevice(device: Device) {
		this.editDevice(device, true);
	}

	removeDevice(device: Device) {
		delete this.devices[device.name];
	}

	private getWindowWidth() {
		let result = window.innerWidth;
		if (this.devices) {
			if (window.innerWidth < (this.plcs().length + 2) * this.deviceWidth) {
				result = (this.plcs().length + 2) * this.deviceWidth;
			}
			if (result < (this.flows().length + 2) * this.deviceWidth) {
				result = (this.flows().length + 2) * this.deviceWidth;
			}
		}
		return  result;
	}

	private getHorizontalCenter() {
		return this.getWindowWidth() / 2;
	}

	private getVerticalCenter() {
		if (this.devices && this.plcs().length && this.flows().length) {
			return window.innerHeight / 5 * 2;
		} else if (this.flows().length) {
			return window.innerHeight / 2;
		} else {
			return window.innerHeight / 3;
		}
	}

	getMainLeftPosition() {
		return this.getHorizontalCenter() - this.mainWidth / 2;
	}

	getMainTopPosition() {
		return this.getVerticalCenter() - this.mainHeight / 2;
	}

	getMainLineLeftPosition() {
		return this.getHorizontalCenter() - 1 + this.lineDeviceSize / 2;
	}

	getMainLineTopPosition(type = null) {
		if (type === 'flow') {
			return this.getVerticalCenter() + this.mainBorder - (this.lineFlowHeight + this.mainHeight / 2);
		}
		return this.getVerticalCenter() + this.mainBorder + this.mainHeight / 2;
	}

	getMainLineHeight(type = null) {
		if (this.devices) {
			if (type === 'flow') {
				if (this.flows().length) {
					return this.lineFlowHeight;
				}
			} else {
				if (this.plcs().length) {
					return this.mainDeviceLineHeight;
				}
			}
		}
		return 0;
	}

	getDeviceLeftPosition(index: number, type = null) {
		if (this.devices) {
			if (type === 'flow') {
				if (this.flows().length) {
					let pos = index + 1;
					let centerd = this.flows().length + 1;
					let result = ((this.getWindowWidth() - this.flowWidth) / centerd) * pos;
					return result;
				}
			} else {
				if (this.plcs().length) {
					let pos = index + 1;
					let centerd = this.plcs().length + 1;
					let result = ((this.getWindowWidth() - this.deviceWidth) / centerd) * pos;
					return result;
				}
			}
		}
		return 0;
	}

	getDeviceTopPosition(type = null) {
		if (type === 'flow') {
			return this.getDeviceLineTopPosition(type) - (this.flowHeight + this.flowBorder * 2);
		} else {
			return this.getVerticalCenter() + (this.mainHeight / 2 + this.deviceLineHeight + this.mainDeviceLineHeight);
		}
	}

	getDeviceLineLeftPosition(index: number, type = null) {
		if (this.devices) {
			if (type === 'flow') {
				if (this.flows().length) {
					let pos = index + 1;
					let centerd = this.flows().length + 1;
					let result = ((this.getWindowWidth() - this.flowWidth) / centerd) * pos;
					result += this.flowBorder + this.flowWidth / 2 - this.lineDeviceSize / 2;
					return result;
				}
			} else {
				if (this.plcs().length) {
					let pos = index + 1;
					let centerd = this.plcs().length + 1;
					let result = ((this.getWindowWidth() - this.deviceWidth) / centerd) * pos;
					result += this.deviceBorder + this.deviceWidth / 2 - this.lineDeviceSize / 2;
					return result;
				}
			}
		}
		return 0;
	}

	getDeviceLineTopPosition(type = null) {
		if (type === 'flow') {
			return this.getDeviceConnectionTopPosition(type) + this.lineFlowSize - this.flowLineHeight;
		} else {
			return this.getDeviceTopPosition(type) - this.deviceLineHeight;
		}
	}

	getDeviceConnectionLeftPosition(type = null) {
		if (type === 'flow') {
			let centerd = this.flows().length + 1;
			let result = ((this.getWindowWidth() - this.flowWidth) / centerd) * 1;
			result += this.deviceBorder + (this.flowWidth - this.lineFlowSize) / 2;
			return result;
		} else {
			let centerd = this.plcs().length + 1;
			let result = ((this.getWindowWidth() - this.deviceWidth) / centerd) * 1;
			result += this.deviceBorder + (this.deviceWidth - this.lineDeviceSize) / 2;
			return result;
		}
	}

	getDeviceConnectionTopPosition(type = null) {
		if (type === 'flow') {
			return this.getMainLineTopPosition(type) - this.lineFlowSize;
		} else {			
			return this.getDeviceLineTopPosition();
		}
	}

	getDeviceConnectionWidth(type = null) {
		if (this.devices) {
			if (type === 'flow') {
				let count = this.flows().length;
				if (count) {
					let centerd = this.flows().length + 1;
					let result = (((this.getWindowWidth() - this.flowWidth) / centerd) * count) - (((this.getWindowWidth() - this.flowWidth) / centerd) * 1);
					return result;
				}
			} else {
				let count = this.plcs().length;
				if (count) {
					let centerd = this.plcs().length + 1;
					let result = (((this.getWindowWidth() - this.deviceWidth) / centerd) * count) - (((this.getWindowWidth() - this.deviceWidth) / centerd) * 1);
					return result;
				}
			}
		}
		return 0;
	}

	devicesValue(type = null): Array<Device> {
		if (this.devices) {
			if (type === 'flow') {
				if (this.flows().length) {
					let result: Device[] = this.flows();
					return result.sort((a, b) => (a.name > b.name) ? 1 : -1);
				}
			} else {
				if (this.plcs().length) {
					let result: Device[] = this.plcs();
					return result.sort((a, b) => (a.name > b.name) ? 1 : -1);
				}
			}
		}
		return [];
	}

	onListDevice(device) {
		this.goto.emit(device);
	}

	isDevicePropertyToShow(device) {
		if (device.property && device.type !== 'OPCUA') {
			return true;
		}
	}

	getDevicePropertyToShow(device) {
		let result = '';
		if (device.property) {
			if (device.type === DeviceType.OPCUA) {
				result = 'OPC-UA'
			} else if (device.type === DeviceType.SiemensS7) {
				result = 'Port: ';
				if (device.property.port) {
					result += device.property.port;
				}
				result +=' / Rack: ';
				if (device.property.rack) {
					result += device.property.rack;
				}
				result += ' / Slot: ';
				if (device.property.slot) {
					result += device.property.slot;
				}
			} else if (device.type === DeviceType.ModbusTCP) {
				result = 'Modbus-TCP  ' + 'Slave ID: ';
				if (device.property.slaveid) {
					result += device.property.slaveid;
				}
			} else if (device.type === DeviceType.ModbusRTU) {
				result = 'Modbus-RTU  ' + 'Slave ID: ';
				if (device.property.slaveid) {
					result += device.property.slaveid;
				}
			}
		}
		return result;
	}

	getDeviceStatusColor(device) {
		if (this.devicesStatus[device.name]) {
			let milli = new Date().getTime();
			if (this.devicesStatus[device.name].last + 15000 < milli) {
				this.devicesStatus[device.name].status = 'connect-error';
				this.devicesStatus[device.name].last = new Date().getTime();
			}
			let st = this.devicesStatus[device.name].status;
			if (st === 'connect-ok') {
				return '#00b050';
			} else if (st === 'connect-error' || st === 'connect-failed') {
				return '#ff2d2d';
			} else if (st === 'connect-off' || st === 'connect-busy') {
				return '#ffc000';
			}
		}
	}

	setDeviceStatus(event) {
		this.devicesStatus[event.id] = { status: event.status, last: new Date().getTime() };
	}

	editDevice(device: Device, toremove: boolean) {
		let exist = Object.values(this.devices).filter((d: Device) => d.id !== device.id).map((d: Device) => { return d.name });
		exist.push('server');
		let tempdevice = JSON.parse(JSON.stringify(device));
		let dialogRef = this.dialog.open(DevicePropertyComponent, {
			panelClass: 'dialog-property',
			data: { device: tempdevice, remove: toremove, exist: exist, availableType: this.plugins },
			position: { top: '60px' }
		});

		dialogRef.afterClosed().subscribe(result => {
			if (result) {
				this.dirty = true;
				if (toremove) {
					this.removeDevice(device);
					this.projectService.removeDevice(device);
				} else {
					let olddevice = JSON.parse(JSON.stringify(device));
					device.name = tempdevice.name;
					device.type = tempdevice.type;
					device.enabled = tempdevice.enabled;
					device.polling = tempdevice.polling;
					if (device.property && tempdevice.property) {
						device.property.address = tempdevice.property.address;
						device.property.port = parseInt(tempdevice.property.port);
						device.property.slot = parseInt(tempdevice.property.slot);
						device.property.rack = parseInt(tempdevice.property.rack);
						device.property.slaveid = tempdevice.property.slaveid;
						device.property.baudrate = tempdevice.property.baudrate;
						device.property.databits = tempdevice.property.databits;
						device.property.stopbits = tempdevice.property.stopbits;
						device.property.parity = tempdevice.property.parity;
						device.property.options = tempdevice.property.options;
						device.property.method = tempdevice.property.method;
						device.property.format = tempdevice.property.format;
					}
					this.projectService.setDevice(device, olddevice, result.security);
				}
			}
			this.checkLayout();
		});
	}

	plcs(): Device[] {
		return <Device[]>Object.values(this.devices).filter((d: Device) => d.type !== DeviceType.WebAPI);
	}

	flows(): Device[] {
		return <Device[]>Object.values(this.devices).filter((d: Device) => d.type === DeviceType.WebAPI);
	}
}
