import { Component, OnInit, OnDestroy, AfterViewInit, Output, EventEmitter } from '@angular/core';
import { MatDialog } from '@angular/material';

import { DevicePropertyComponent } from './../device-property/device-property.component';
import { ProjectService } from '../../_services/project.service';
import { Device, DeviceType, DeviceNetProperty } from './../../_models/device';
import { Utils } from '../../_helpers/utils';

@Component({
	selector: 'app-device-map',
	templateUrl: './device-map.component.html',
	styleUrls: ['./device-map.component.scss']
})
export class DeviceMapComponent implements OnInit, OnDestroy, AfterViewInit {

	@Output() goto: EventEmitter<Device> = new EventEmitter();

	server: Device;
	devices = {};

	devicesStatus = {};
	dirty: boolean = false;

	constructor(private dialog: MatDialog,
		private projectService: ProjectService) { }

	ngOnInit() {
		this.loadCurrentProject();
	}

	ngAfterViewInit() {
	}

	ngOnDestroy() {
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

	getDevicePosition(index: number) {
		if (this.devices && Object.values(this.devices).length) {
			let offset = 160; // scss.$card-width
			let pos = index + 1;
			let centerd = Object.keys(this.devices).length + 1;
			let result = ((window.innerWidth - offset) / centerd) * pos;
			return result;
		}
		return 0;
	}

	getDeviceLinePosition(index: number) {
		if (this.devices && Object.values(this.devices).length) {
			let offset = 160; // scss.$card-width
			let pos = index + 1;
			let centerd = Object.keys(this.devices).length + 1;
			let result = ((window.innerWidth - offset) / centerd) * pos;
			result += (160 - 6) / 2; // card center: scss.$card-width - $line-size
			return result;
		}
		return 0;
	}

	getDeviceConnectionLeftPosition(index: number) {
		let offset = 160; // scss.$card-width
		let centerd = Object.keys(this.devices).length + 1;
		let result = ((window.innerWidth - offset) / centerd) * 1;
		result += (160 - 6) / 2; // card center: scss.$card-width - $line-size
		return result;
	}

	getDeviceConnectionWidth(index: number) {
		let offset = 160; // scss.$card-width
		let pos = index;
		let centerd = Object.keys(this.devices).length + 1;
		let result = (((window.innerWidth - offset) / centerd) * pos) - (((window.innerWidth - offset) / centerd) * 1);
		return result;
	}

	devicesValue(): Array<Device> {
		if (this.devices && Object.values(this.devices).length) {
			let result: Device[] = Object.values(this.devices);
			return result.sort((a, b) => (a.name > b.name) ? 1 : -1);
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

	getDeviceStatusColor(device) {
		let st = this.devicesStatus[device.name];
		if (this.devicesStatus[device.name]) {
			if (st === 'connect-ok') {
				return '#00b050';
			} else if (st === 'connect-error') {
				return '#ff2d2d';
			} else if (st === 'connect-off') {
				return '#ffc000';
			}
		}
	}

	setDeviceStatus(event) {
		this.devicesStatus[event.id] = event.status;
	}

	editDevice(device: Device, toremove: boolean) {
		let exist = Object.values(this.devices).filter((d: Device) => d.id !== device.id).map((d: Device) => { return d.name });
		exist.push('server');
		let tempdevice = JSON.parse(JSON.stringify(device));
		let dialogRef = this.dialog.open(DevicePropertyComponent, {
			// minWidth: '700px',
			// minHeight: '700px',
			panelClass: 'dialog-property',
			data: { device: tempdevice, remove: toremove, exist: exist },
			position: { top: '80px' }
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
					if (device.property && tempdevice.property) {
						device.property.address = tempdevice.property.address;
						device.property.port = parseInt(tempdevice.property.port);
						device.property.slot = parseInt(tempdevice.property.slot);
						device.property.rack = parseInt(tempdevice.property.rack);
					}
					this.projectService.setDevice(device, olddevice, result.security);
				}
			}
		});
	}
}
