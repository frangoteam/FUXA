export class Graph {
    id: string;
    name: string;
    type: GraphType;
    property: any;
    sources: GraphSource[] = [];

    constructor (_type: GraphType, _id?: string, _name?: string) {
        this.type = _type;
        this.id = _id;
        this.name = _name;
        if (this.type === GraphType.bar) {
            this.property = new GraphBarProperty();
        }
    } 
}

export class GraphBarProperty {
    xtype: GraphBarXType;
    
    constructor (_xtype?: GraphBarXType) {
        if (_xtype) {
            this.xtype = _xtype;
        } else {
            this.xtype = <GraphBarXType>Object.keys(GraphBarXType).find(key => GraphBarXType[key] === GraphBarXType.value)
        }
    }
}

export class GraphSource {
    device: string;
    id: string;
    name: string;
    label: string;
    color: string;
    fill?: string;
}

export enum GraphType {
    bar,
    pie
}

export enum GraphBarXType {
    value = 'graph.bar-xtype-value',
    date = 'graph.bar-xtype-date',
    // sendMsg = 'alarm.action-onsendmsg',
}