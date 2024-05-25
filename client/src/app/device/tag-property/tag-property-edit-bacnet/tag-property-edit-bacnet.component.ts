import { Component, OnInit, Inject, OnDestroy, ViewChild, Output, EventEmitter } from '@angular/core';
import { HmiService } from '../../../_services/hmi.service';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { BACnetObjectType, Device, Tag } from '../../../_models/device';
import { Subject, takeUntil } from 'rxjs';
import { TreetableComponent, Node, NodeType } from '../../../gui-helpers/treetable/treetable.component';

@Component({
    selector: 'app-tag-property-edit-bacnet',
    templateUrl: './tag-property-edit-bacnet.component.html',
    styleUrls: ['./tag-property-edit-bacnet.component.css']
})
export class TagPropertyEditBacnetComponent implements OnInit, OnDestroy {
    @Output() result = new EventEmitter<any>();
    private destroy$ = new Subject<void>();
    @ViewChild(TreetableComponent, { static: false }) treetable: TreetableComponent;

    config = {
        height: '640px',
        width: '1000px'
    };

    constructor(
        private hmiService: HmiService,
        public dialogRef: MatDialogRef<TagPropertyEditBacnetComponent>,
        @Inject(MAT_DIALOG_DATA) public data: TagPropertyBacNetData) {
    }

    ngOnInit() {
        this.hmiService.onDeviceBrowse.pipe(
            takeUntil(this.destroy$),
        ).subscribe(values => {
            if (this.data.device.id === values.device) {
                if (values.error) {
                    this.addError(values.node, values.error);
                } else {
                    this.addNodes(values.node, values.result);
                }
            }
        });
        this.hmiService.onDeviceNodeAttribute.pipe(
            takeUntil(this.destroy$),
        ).subscribe(values => {
            if (this.data.device.id === values.device) {
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
        this.queryNext(null);
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    queryNext(node: Node) {
        let n = (node) ? { id: node.id } : null;
        if (node) {
            n['parent'] = (node.parent) ? node.parent.id : null;
        }
        this.hmiService.askDeviceBrowse(this.data.device.id, n);
    }

    addNodes(parent: Node, nodes: any) {
        if (nodes) {
            let tempTags = Object.values(this.data.device.tags);
            nodes.forEach((n) => {
                let node = new Node(n.id, n.name);
                node.class = n.class;
                node.property = this.getProperty(n);
                node.class = Node.strToType(n.class);
                node.type = n.type;
                var typeText = Object.values(BACnetObjectType)[n.type];
                if (typeText) {
                    node.property = typeText;
                }
                let enabled = true;
                if (node.class === NodeType.Variable) {
                    const selected = tempTags.find((t: Tag) => t.address === n.id);
                    if (selected) {
                        enabled = false;
                    }
                }
                this.treetable.addNode(node, parent, enabled, false);
            });
            this.treetable.update();
        }
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

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.data.nodes = [];
        Object.keys(this.treetable.nodes).forEach((key) => {
            let n: Node = this.treetable.nodes[key];
            if (n.checked && n.enabled && (n.type || !n.childs || n.childs.length == 0)) {
                this.data.nodes.push(this.treetable.nodes[key]);
            }
        });
        this.result.emit(this.data);
    }
}

export interface TagPropertyBacNetData {
    device: Device;
    nodes: Node[];
}
