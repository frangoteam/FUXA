import { Component, EventEmitter, Inject, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { Device, Tag } from '../../../_models/device';
import { Subject, takeUntil } from 'rxjs';
import { HmiService } from '../../../_services/hmi.service';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TreetableComponent, Node, NodeType } from '../../../gui-helpers/treetable/treetable.component';
import { Utils } from '../../../_helpers/utils';

@Component({
    selector: 'app-tag-property-edit-webapi',
    templateUrl: './tag-property-edit-webapi.component.html',
    styleUrls: ['./tag-property-edit-webapi.component.css']
})
export class TagPropertyEditWebapiComponent implements OnInit, OnDestroy {

    @Output() result = new EventEmitter<TagPropertyWebApiData>();
    private destroy$ = new Subject<void>();
    @ViewChild(TreetableComponent, { static: false }) treetable: TreetableComponent;

    config = {
        height: '640px',
        width: '1000px',
        type: 'todefine'
    };

    constructor(
        private hmiService: HmiService,
        public dialogRef: MatDialogRef<TagPropertyEditWebapiComponent>,
        @Inject(MAT_DIALOG_DATA) public data: TagPropertyWebApiData) {
    }

    ngOnInit() {
        this.hmiService.onDeviceWebApiRequest.pipe(
            takeUntil(this.destroy$),
        ).subscribe(res => {
            if (res.result) {
                this.addTreeNodes(res.result);
                this.treetable.update(false);
            }
        });
        this.hmiService.askWebApiProperty(this.data.device.property);
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

    addTreeNodes(nodes: any, id = '', parent: Node = null) {
        let nodeId = id;
        let nodeName = id;
        if (parent && parent.id) {
            nodeId = parent.id + ':' + nodeId;
        }
        let node = new Node(nodeId, nodeName);
        node.parent = parent;
        if (Array.isArray(nodes)) {
            // nodeId = nodeId + '[]';
            node.class = NodeType.Array;
            node.setToDefine();
            node.expanded = true;
            this.treetable.addNode(node, parent, true);
            let idx = 0;
            for(var n in nodes) {
                this.addTreeNodes(nodes[n], '[' + idx++ + ']', node);
            }
        } else if (nodes && typeof nodes === 'object') {
            node.expanded = true;
            node.class = NodeType.Object;
            this.treetable.addNode(node, parent, true);
            for(var n in nodes) {
                this.addTreeNodes(nodes[n], n, node);
                if (parent) {
                    parent.addToDefine(n);
                }
            }
        } else {
            node.expandable = false;
            node.class = NodeType.Variable;
            node.childs = [];
            node.property = nodes;
            let enabled = true;
            const selected = Object.values(this.data.device.tags).find((t: Tag) => t.address === nodeId);
            if (node.parent && node.parent.parent && node.parent.parent.class === NodeType.Array) {
                node.class = NodeType.Item;
                if (!node.parent.parent.todefine.id && this.data.device.tags[nodeId] && this.data.device.tags[nodeId].options) {
                    node.parent.parent.todefine.id = this.data.device.tags[nodeId].options.selid;
                    node.parent.parent.todefine.value = this.data.device.tags[nodeId].options.selval;
                }
            } else if (selected) {
                enabled = false;
            }
            this.treetable.addNode(node, parent, enabled);
        }
    }

    getSelectedTreeNodes(nodes: Array<Node>, defined: any): Array<Node> {
        let result = [];
        for (let key in nodes) {
            let n: Node = nodes[key];
            if (n.class === NodeType.Array && n.todefine && n.todefine.id && n.todefine.value) {
                let arrayResult = this.getSelectedTreeNodes(n.childs, n.todefine);
                for (let ak in arrayResult) {
                    result.push(arrayResult[ak]);
                }
            } else if (n.class === NodeType.Object && defined && defined.id && defined.value) {
                // search defined attributes
                let childId = null, childValue = null;
                for (let childKey in n.childs)
                {
                    let child = n.childs[childKey];
                    if (child.text === defined.id) {
                        childId = child;
                    } else if (child.text === defined.value) {
                        childValue = child;
                    }
                }
                if (childId && childValue) {
                    let objNode = new Node(childId.id, childId.property);  // node array element (id: id:id, text: current id value)
                    objNode.class = NodeType.Reference;                     // to check
                    objNode.property = childValue.id;                        // value:id
                    objNode.todefine = { selid: childId.text, selval: childValue.text };
                    objNode.type = Utils.getType(childValue.property);
                    objNode.checked = true;
                    objNode.enabled = n.enabled;
                    const exist = Object.values(this.data.device.tags).find((tag: Tag) => tag.address === objNode.id && tag.memaddress === objNode.property);
                    if (exist) {
                        objNode.enabled = false;
                    }
                    result.push(objNode);
                }
            } else if (n.class === NodeType.Variable && n.checked) {
                let objNode = new Node(n.id, n.text);
                objNode.type = Utils.getType(n.property);
                objNode.checked = n.checked;
                objNode.enabled = n.enabled;
                result.push(objNode);
            }
        }
        return result;
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onOkClick(): void {
        this.data.nodes = [];
        let result = this.getSelectedTreeNodes(Object.values(this.treetable.nodes), null);
        result.forEach((n: Node) => {
            if (n.checked && n.enabled) {
                this.data.nodes.push(n);
            }
        });
        this.result.emit(this.data);
    }
}

export interface TagPropertyWebApiData {
    device: Device;
    nodes: Node[];
}
