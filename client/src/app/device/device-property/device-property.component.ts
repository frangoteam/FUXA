import { Component, OnInit, Inject } from '@angular/core';
import {  MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

import { DeviceType } from './../../_models/device';
import { Utils } from '../../_helpers/utils';

@Component({
  selector: 'app-device-property',
  templateUrl: './device-property.component.html',
  styleUrls: ['./device-property.component.css']
})
export class DevicePropertyComponent implements OnInit {

  // @Input() name: any;
  deviceType: any;
  isFuxaServer: boolean = false;
  isToRemove: boolean = false;

  constructor(
    public dialogRef: MatDialogRef<DevicePropertyComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any) { }

  ngOnInit() {
    this.deviceType = DeviceType;
    this.isToRemove = this.data.remove;
    this.isFuxaServer = (this.data.device.type && this.data.device.type === DeviceType.FuxaServer) ? true : false;
    if (!this.isFuxaServer) {
      delete this.deviceType.FuxaServer;
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
}
