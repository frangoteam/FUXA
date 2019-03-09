import { Component, OnInit, Inject } from '@angular/core';
import {  MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

import { Device, TagType, Tag } from './../../_models/device';

@Component({
  selector: 'app-tag-property',
  templateUrl: './tag-property.component.html',
  styleUrls: ['./tag-property.component.css']
})
export class TagPropertyComponent implements OnInit {

  tagType: any;
  error: string;
  existing: string[] = [];
  constructor(
    public dialogRef: MatDialogRef<TagPropertyComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any) { 
      Object.keys(this.data.device.tags).forEach((key) => {
        let tag = this.data.device.tags[key];
        if (tag.name !== this.data.tag.name) {
          this.existing.push(tag.name);
        }
      });
    }

  ngOnInit() {
    this.tagType = TagType;
  }

  onNoClick(): void {
    this.dialogRef.close();
  }

  onOkClick(): void {
  }

  onCheckValue(tag) {
    if (this.existing.indexOf(tag.target.value) !== -1) {
      this.error = "Tagname exist!"
    } else {
      this.error = "";
    }
  }

  devicesValue() : Array<Device> {
    return Object.values(this.data.devices);
  }
}
