/* eslint-disable @angular-eslint/component-selector */
import { Component, OnInit, Input, Output, ViewChild, ElementRef, EventEmitter } from '@angular/core';

@Component({
    selector: 'ngx-treetable',
    templateUrl: './treetable.component.html',
    styleUrls: ['./treetable.component.css']
})
export class TreetableComponent implements OnInit {

    @Input() config: any;
    @Output() expand = new EventEmitter();
    @ViewChild('treetable', {static: true}) treetable: ElementRef;


    TypeOfTree = TreeType;
    treeType = TreeType.Standard;
    nodeType = NodeType;

    nodes = {};
    list: any[] = [];

    containerProperty = { width: '100%', height: '100%' };

    constructor() { }

    ngOnInit() {
        if (this.config) {
            if (this.config.width) {
                this.containerProperty.width = this.config.width;
            }
            if (this.config.height) {
                this.containerProperty.height = this.config.height;
            }
            if (this.config.type === TreeType.ToDefine) {
                this.treeType = TreeType.ToDefine;
            }
        }
    }

    onExpandToggle(node: Node) {
        const currentPosition = this.treetable.nativeElement.scrollTop;
        node.expanded = (node.expanded) ? false : true;
        if (node.expanded) {
            if (!node.childs.length) {
                this.expand.emit(node);
            }
            this.hideNode(node, true);
        } else {
            this.hideNode(node, false);
        }
        this.list = this.nodeToItems((this.treeType === TreeType.ToDefine) ? false : true);
        setTimeout(() => { this.treetable.nativeElement.scrollTop = currentPosition; }, 1);
    }

    hideNode(node: Node, visible: boolean) {
        Object.values(node.childs).forEach((n) => {
            n.visible = visible;
            this.hideNode(n, (visible) ? n.expanded : visible);
        });
    }

    addNode(node: Node, parent: Node, enabled: boolean, flat?: boolean) {
        if (parent) {
            let refp = this.nodes[parent.id];
            node.setParent(refp);
            if (node.parent) {
                node.parent.waiting = false;
            }
            node.enabled = enabled;
            if (!enabled) {
                node.checked = true;
            }
        }
        if (flat) {
            node.enabled = enabled;
            if (!enabled) {
                node.checked = true;
            }
        }
        if (Object.keys(this.nodes).indexOf(node.id) < 0) {
            this.nodes[node.id] = node;
        }
    }

    update(sort = true) {
        this.list = this.nodeToItems(sort);
    }

    setNodeProperty(node: Node, pro: string) {
        if (this.nodes[node.id]) {
            this.nodes[node.id].property = pro;
            this.nodes[node.id].type = node.type;
        }
    }

    nodeToItems(sort = true): Array<Node> {
        if (this.nodes && Object.values(this.nodes).length) {
            let result = [];
            Object.values(this.nodes).forEach((value: Node) => {
                if (value.visible) {
                    result.push(value);
                }
            });
            if (sort) {
                return result.sort((a, b) => (a.path > b.path) ? 1 : -1);
            } else {
                return result;
            }
        } else {
            return [];
        }
    }

    changeStatus(node: Node, $event) {
        if ((node.childs) && (node.childs.length > 0)) {
            node.childs.forEach((child) => {
                if (child.enabled && child.class === this.nodeType.Variable) {
                    child.checked = node.checked;
                }
            });
        }
    }

    expandable(type: NodeType) {
        if (type === NodeType.Object) {
            return true;
        } else {
            return false;
        }
    }

    getDefinedKey(todefine) {
        return '';
    }

    getToDefineOptions(todefine) {
        return Object.keys(todefine.options);
    }
}

export class Node {
    static readonly SEPARATOR = '>';
    id = '';
    path = '';
    text = '';
    class: NodeType;
    childPos = 0;
    expandable = true;
    expanded = false;
    visible = true;
    parent: Node = null;
    property = '';
    type = '';          // boolean, int ...
    checked = false;
    childs: Node[] = [];
    waiting = true;
    enabled = true;
    todefine: any = null;

    constructor(id: string, text: string) {
        this.id = id;
        this.text = text;
        this.path = this.text;
    }

    setParent(parent: Node) {
        if (parent) {
            this.parent = parent;
            this.path = parent.path + Node.SEPARATOR + this.text;
            this.childPos = parent.childPos + 1;
            this.parent.childs.push(this);
        }
    }

    setToDefine() {
        this.todefine = { options: [''], id: '', value: '' };
    }

    addToDefine(opt: string) {
        if (this.todefine && this.todefine.options.indexOf(opt) === -1) {
            this.todefine.options.push(opt);
        }
    }

    static strToType(str: string): any {
        if (NodeType[str]) {
            return NodeType[str];
        }
        return str;
    }
}

export enum NodeType {
    Unspecified = 0,    //
    Object = 1,         // OPCUA 'Object',
    Variable = 2,       // OPCUA 'Variable',
    Methode = 4,        // OPCUA 'Methode'
    ObjectType = 8,
    VariableType = 16,
    ReferenceType = 32,
    DataType = 64,
    View = 128,
    Array = 256,        // JSON
    Item = 512,         // JSON
    Reference = 1024    // JSON
}

export enum TreeType {
    Standard = 'standard',  // ask expand,
    ToDefine = 'todefine'   // property to define (key and value)
}
