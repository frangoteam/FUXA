import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { Subscription } from "rxjs/Subscription";

import { DeviceListComponent } from './device-list/device-list.component';
import { DeviceMapComponent } from './device-map/device-map.component';
import { Device } from './../_models/device';
import { ProjectService } from '../_services/project.service';
import { HmiService } from '../_services/hmi.service';

@Component({
  selector: 'app-device',
  templateUrl: './device.component.html',
  styleUrls: ['./device.component.css']
})
export class DeviceComponent implements OnInit, OnDestroy, AfterViewInit {

  @ViewChild('devicelist') deviceList: DeviceListComponent;
  @ViewChild('devicemap') deviceMap: DeviceMapComponent;

  private subscriptionSave: Subscription;
  private subscriptionLoad: Subscription;
  private subscriptionDeviceChange: Subscription;
  private subscriptionVariableChange: Subscription;
  showMode: string = 'map';

  constructor(private projectService: ProjectService,
              private hmiService: HmiService) { }

  ngOnInit() {
    this.subscriptionSave = this.projectService.onSaveCurrent.subscribe(saveas => {
      this.saveDevices();
      if (saveas) {
        this.projectService.saveAs();
      }
    });
    this.subscriptionLoad = this.projectService.onLoadHmi.subscribe(res => {
      this.deviceMap.loadCurrentProject();
      // this.deviceList.loadCurrentProject();
    });
    this.subscriptionDeviceChange = this.hmiService.onDeviceChanged.subscribe(event => {
      this.deviceMap.setDeviceStatus(event);
    });
    this.subscriptionVariableChange = this.hmiService.onVariableChanged.subscribe(event => {
      this.deviceList.updateDeviceValue();
    });    
    this.hmiService.askDeviceStatus();
  }

  ngAfterViewInit() {
    this.showMode = 'map';
  }

  ngOnDestroy() {
    // this.checkToSave();
    try {
      if (this.subscriptionSave) {
        this.subscriptionSave.unsubscribe();
      }
      if (this.subscriptionLoad) {
        this.subscriptionLoad.unsubscribe();
      }
      if (this.subscriptionDeviceChange) {
        this.subscriptionDeviceChange.unsubscribe();
      }
      if (this.subscriptionVariableChange) {
        this.subscriptionVariableChange.unsubscribe();
      }      
    } catch (e) {
    }
  }

  show(mode: string) {
    // this.checkToSave();
    this.showMode = mode;
    if (this.showMode === 'tags') {
      this.deviceList.updateDeviceValue();
      try {
        if (Object.values(this.deviceMap.devicesValue()).length > 0) {
          this.deviceList.setSelectedDevice(this.deviceMap.devicesValue()[0]);
        }
      } catch (e) {
      }
    }
  }

  saveDevices() {
    // this.deviceMap.saveDeviceMap();
    // this.deviceList.saveDeviceList(); 
    this.projectService.save();
    this.deviceMap.dirty = false;
    this.deviceList.dirty = false;

  }

  // checkToSave() {
  //   if (this.deviceList.dirty || this.deviceMap.dirty) {
  //     // if (window.confirm('You want to save the Project change?')) {
  //       this.saveDevices();
  //     // }
  //   }
  // }

  gotoMap() {
    this.show('map');
  }

  gotoList(device: Device) {
    this.show('tags');
    this.deviceList.setSelectedDevice(device);
  }
}
