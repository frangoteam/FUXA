import { Component, OnInit, OnDestroy, Inject, ViewChild } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { Subscription } from "rxjs";

import { Device, TagType, Tag, DeviceType, ModbusTagType, BACnetObjectType } from './../../_models/device';
import { TreetableComponent, Node } from '../../gui-helpers/treetable/treetable.component';
import { HmiService } from '../../_services/hmi.service';
import { TranslateService } from '@ngx-translate/core';
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
    memAddress = {'Coil Status (Read/Write 000001-065536)': '000000', 'Digital Inputs (Read 100001-165536)': '100000', 'Input Registers (Read  300001-365536)': '300000', 'Holding Registers (Read/Write  400001-465535)': '400000'};
    private subscriptionBrowse: Subscription;
    private subscriptionNodeAttribute: Subscription;

    @ViewChild(TreetableComponent) treetable: TreetableComponent;

    constructor(
        private hmiService: HmiService,
        private translateService: TranslateService,
        public dialogRef: MatDialogRef<TagPropertyComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any) {

        this.tagType = TagType;
        if (this.data.device.type === DeviceType.OPCUA || this.data.device.type === DeviceType.BACnet) {
            this.withtree = true;
            this.config.height = '640px';
            this.config.width = '1000px';
        } else {
            if (this.isModbus()) {
                this.tagType = ModbusTagType;
            }
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
        if (this.withtree) {
            if (this.data.device.type === DeviceType.OPCUA || this.data.device.type === DeviceType.BACnet) {
                this.subscriptionBrowse = this.hmiService.onDeviceBrowse.subscribe(values => {
                    if (this.data.device.name === values.device) {
                        if (values.error) {
                            this.addError(values.node, values.error);
                        } else {
                            this.addNodes(values.node, values.result);
                        }
                    }
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
            this.error = '';
            this.translateService.get('msg.device-tag-exist').subscribe((txt: string) => { this.error = txt });
        } else {
            this.error = '';
        }
    }

    addNodes(parent: Node, nodes: any) {
        if (nodes) {
            nodes.forEach((n) => {
                let node = new Node(n.id, n.name);
                node.class = n.class;
                node.property = this.getProperty(n);
                if (this.data.device.type === DeviceType.BACnet) {
                    node.type = n.type;
                    var typetext = Object.values(BACnetObjectType)[n.type];
                    if (typetext) {
                        node.property = typetext;
                    }
                    // node.property = Object.keys(BACnetObjectType)[Object.values(BACnetObjectType).indexOf(n.type)] + '   ' + node.property;
                    // Object.keys(AlarmAckMode)[Object.values(AlarmAckMode).indexOf(AlarmAckMode.float)]
                }
                let enabled = true;
                if (this.data.device.tags[n.id] && node.class === 'Variable') {
                    // node allready selected
                    enabled = false;
                }
                this.treetable.addNode(node, parent, enabled);
                if (node.class === 'Variable' && this.data.device.type !== DeviceType.BACnet) {
                    this.hmiService.askNodeAttributes(this.data.device.name, n);
                }
            });
            this.treetable.update();
        }
    }

    getProperty(n: any) {
        if (n.class === 'Object') { // Object
            return '';
        } else if (n.class === 'Variable') {
            return 'Variable';
        } else if (n.class === 'Method') {
            return 'Method';
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
        if (this.data.device.type === DeviceType.BACnet && node) {
            n['parent'] = (node.parent) ? node.parent.id : null;
        }
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

    isSiemensS7() {
		return (this.data.device.type === DeviceType.SiemensS7) ? true : false;
	}

	isModbus() {
		return (this.data.device.type === DeviceType.ModbusRTU || this.data.device.type === DeviceType.ModbusTCP) ? true : false;
    }

    isOpcua() {
		return (this.data.device.type === DeviceType.OPCUA) ? true : false;
    }
    
    checkMemAddress(memaddress) {
        if (memaddress === '000000' || memaddress === '100000') {
            this.data.tag.type = ModbusTagType.Bool;
        }
    }

    isValidate() {
        if (this.error) {
            return false;
        } else if (this.isOpcua()) {
            return true;
        } else if (this.data.tag && !this.data.tag.name) {
            return false;
        } else if (this.isModbus() && (!this.data.tag.address || parseInt(this.data.tag.address) <= 0)) {
            return false;
        }
        return true;
    }
}
