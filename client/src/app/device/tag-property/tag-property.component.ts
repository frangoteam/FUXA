import { Component, OnInit, OnDestroy, Inject, ViewChild } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { Subscription } from "rxjs/Subscription";

import { Device, TagType, Tag, DeviceType } from './../../_models/device';
import { TreetableComponent, Node } from '../../gui-helpers/treetable/treetable.component';
import { HmiService } from '../../_services/hmi.service';
import { t } from '@angular/core/src/render3';

@Component({
  selector: 'app-tag-property',
  templateUrl: './tag-property.component.html',
  styleUrls: ['./tag-property.component.css']
})
export class TagPropertyComponent implements OnInit, OnDestroy {

  tagType: any;
  error: string;
  existing: string[] = [];
  withtree: boolean = false;
  config = { width: '100%', height: '600px' };

  private subscriptionBrowse: Subscription;
  private subscriptionNodeAttribute: Subscription;

  @ViewChild(TreetableComponent) treetable: TreetableComponent;

  constructor(
    private hmiService: HmiService,
    public dialogRef: MatDialogRef<TagPropertyComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any) {
    if (this.data.device.type === DeviceType.OPCUA) {
      this.withtree = true;
    } else {
      this.config.height = '0px';
      Object.keys(this.data.device.tags).forEach((key) => {
        let tag = this.data.device.tags[key];
        if (tag.id) {
          if (tag.id !== this.data.tag.id) {
            this.existing.push(tag.name);
          }
        } else if (tag.name !== this.data.tag.name) {
          this.existing.push(tag.name);
        }
      });
    }
  }

  ngOnInit() {
    this.tagType = TagType;

    if (this.withtree) {
      if (this.data.device.type === DeviceType.OPCUA) {
        this.subscriptionBrowse = this.hmiService.onDeviceBrowse.subscribe(values => {
          if (this.data.device.name === values.device) {
            if (values.error) {
              this.addError(values.node, values.error);
            } else {
              this.addNodes(values.node, values.result);
            }
          }
          // console.log(values);
        });
        this.subscriptionNodeAttribute = this.hmiService.onDeviceNodeAttribute.subscribe(values => {
          if (this.data.device.name === values.device) {
            if (values.error) {
            //   this.addError(values.node, values.error);
            } else if (values.node) {
              if (values.node.attribute[14]) {    // datatype
                values.node.type = values.node.attribute[14];
              }
              this.treetable.setNodeProperty(values.node, this.attributeToString(values.node.attribute));
            }
          }
          // console.log(values);
        });        
      }
      this.queryNext(null);
    }
  }

  ngOnDestroy() {
    // this.checkToSave();
    try {
      if (this.subscriptionBrowse) {
        this.subscriptionBrowse.unsubscribe();
      }
      if (this.subscriptionNodeAttribute) {
        this.subscriptionNodeAttribute.unsubscribe();
      }
    } catch (e) {
    }
  }

  onNoClick(): void {
    this.dialogRef.close();
  }

  onOkClick(): void {
    this.data.nodes = [];
    Object.keys(this.treetable.nodes).forEach((key) => {
      let n: Node = this.treetable.nodes[key];
      if (n.checked) {
        this.data.nodes.push(this.treetable.nodes[key]);
      }
    });
  }

  onCheckValue(tag) {
    if (this.existing.indexOf(tag.target.value) !== -1) {
      this.error = "Tagname exist!"
    } else {
      this.error = "";
    }
  }

  addNodes(parent: Node, nodes: any) {
    nodes.forEach((n) => {
      let node = new Node(n.id, n.name);
      node.class = n.class;
      node.property = this.getProperty(n);
      let enabled = true;
      if (this.data.device.tags[n.id] && node.class === 'Variable') {
        // node allready selected
        enabled = false;
      }
      this.treetable.addNode(node, parent, enabled);
      if (node.class === 'Variable') {
        this.hmiService.askNodeAttributes(this.data.device.name, n);
      }
    });
      this.treetable.update();
  }

  getProperty(n: any) {
    if (n.class === 'Object') { // Object
      return '';
    } else if (n.class === 'Variable') {
      return "Variable";
    } else if (n.class === 'Method') {
      return "Method";
    }
    return '';
  }

  addError(parent: string, error: any) {

  }

  devicesValue(): Array<Device> {
    return Object.values(this.data.devices);
  }

  queryNext(node: Node) {
    let n = (node) ? { id: node.id } : null; 
    this.hmiService.askDeviceBrowse(this.data.device.name, n);
  }

  attributeToString(attribute) {
    let result = '';
    if (attribute) {
      Object.values(attribute).forEach((x) => {
        if (result.length) {
          result += ', ';
        }
        result += x;
      });
    }
    return result;
  }
}
