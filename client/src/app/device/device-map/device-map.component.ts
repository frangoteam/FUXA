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
  @Output() save = new EventEmitter();

  server: Device;
  devices = {};
  devicesStatus = {};
  dirty: boolean = false;

  constructor(private dialog: MatDialog,
    private projectService: ProjectService) { }

  ngOnInit() {

  }

  ngAfterViewInit() {
    this.loadCurrentProject();
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
    // this.server = this.projectService.getServer();//JSON.parse(JSON.stringify(this.projectService.getServer()));
    // this.devices = this.projectService.getDevices();//JSON.parse(JSON.stringify(this.projectService.getDevices()));
  }

  // saveDeviceMap() {
  //   if (this.dirty) {
  //     this.projectService.setServer(this.server, true);
  //     this.projectService.setDevices(this.devices, true);
  //   }
  // }

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

  checkToAddDevice(device: Device) {
    // let dev = this.devices[device.name];
    // this.devices[device.name] = device;
    // for (let key in Object.keys(this.devices)) {
    Object.keys(this.devices).forEach((key) => {
      if (this.devices[key].id === device.id) {
        delete this.devices[key];
        return;
      }
    });
    this.devices[device.name] = device;
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
      let result = [];
      Object.values(this.devices).forEach((value) => {
        result.push(value);
      });
      return result.sort((a,b) => (a.name > b.name) ? 1 : -1);
    }
    return [];
  }

  onListDevice(device) {
    this.goto.emit(device);
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
    console.log('device set: ' + event.id + ' ' + event.status);
    this.devicesStatus[event.id] = event.status; 
  }

  editDevice(device: Device, toremove: boolean) {
    // console.log('The Edit Device open');
    let tempdevice = JSON.parse(JSON.stringify(device));
    let dialogRef = this.dialog.open(DevicePropertyComponent, {
      // minWidth: '700px',
      // minHeight: '700px',
      panelClass: 'dialog-property',
      data: { device: tempdevice, remove: toremove },
      position: { top: '80px' }
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.dirty = true;
        if (toremove) {
          this.removeDevice(device);
        } else {
          // console.log('The Edit Device was closed');
          device.name = tempdevice.name;
          device.type = tempdevice.type;
          device.enabled = tempdevice.enabled;
          if (device.property && tempdevice.property) {
            device.property.address = tempdevice.property.address;
            device.property.port = parseInt(tempdevice.property.port);
            device.property.slot = parseInt(tempdevice.property.slot);
            device.property.rack = parseInt(tempdevice.property.rack);
          }
          if (device.type === DeviceType.SiemensS7) {
            this.checkToAddDevice(device);
          }
          this.save.emit();
          // callback(result.settings);
          // if (this.isToInitInEditor(result.settings)) {
          //   this.checkElementToInit(result.settings);
          // }
        }
      }
    });
  }
}
