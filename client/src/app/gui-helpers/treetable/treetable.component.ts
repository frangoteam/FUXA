import { Component, OnInit, Input, Output, ViewChild, ElementRef, EventEmitter } from '@angular/core';

@Component({
  selector: 'ngx-treetable',
  templateUrl: './treetable.component.html',
  styleUrls: ['./treetable.component.css']
})
export class TreetableComponent implements OnInit {

  @Input() config: any;
  @Output() expand = new EventEmitter();
  @ViewChild('treetable') treetable: ElementRef;

  nodeType = NodeType;

  nodes = {};
  private list: any[] = [];

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
    }
  }

  onExpandToggle(node: Node) {
    node.expanded = (node.expanded) ? false : true;
    if (node.expanded) {
        if (!node.childs.length) {
            this.expand.emit(node);
        }
      this.hideNode(node, true);
    } else {
      this.hideNode(node, false);
    }
    this.list = this.nodeToItems();
  }

  hideNode(node: Node, visible: boolean) {
    Object.values(node.childs).forEach((n) => {
      n.visible = visible;
      this.hideNode(n, (visible) ? n.expanded : visible);
    });
  }

  addNode(node: Node, parent: Node, enabled: boolean) {
    if (parent) {
      let refp = this.nodes[parent.id];
      node.setParent(refp);
      node.parent.waiting = false;
      node.enabled = enabled;
      if (!enabled) {
        node.checked = true;
      }
    }
    if (Object.keys(this.nodes).indexOf(node.id) < 0) {
      this.nodes[node.id] = node;
    }
  }

  update() {
    this.list = this.nodeToItems();
  }

  setNodeProperty(node: Node, pro: string) {
    if (this.nodes[node.id]) {
      this.nodes[node.id].property = pro;
      this.nodes[node.id].type = node.type;
    }
  }

  nodeToItems(): Array<Node> {
    if (this.nodes && Object.values(this.nodes).length) {
      let result = [];
        Object.values(this.nodes).forEach((value: Node) => {
          if (value.visible) {
              result.push(value);
          }
      });
      return result.sort((a, b) => (a.path > b.path) ? 1 : -1);
    } else {
      return [];
    }
  }

  changeStatus(node: Node, $event) {
  }

  expandable(type: NodeType) {
    if (type === NodeType.Object) {
      return true;
    } else {
      return false;
    }
  }
}

export class Node {
  static readonly SEPARATOR = '>';
  id: string = '';
  path: string = '';
  text: string = '';
  class: NodeType;
  childPos: number = 0;
  expanded: boolean = false;
  visible: boolean = true;
  parent: Node = null;
  property: string = '';
  type: string = '';          // boolean, int ...
  checked: boolean = false;
  childs: Node[] = [];
  waiting: boolean = true;
  enabled: boolean = true;
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
}


export enum NodeType {
  Object = 'Object',
  Variable = 'Variable',
  Methode = 'Methode'
}