export class Graph {
    id: string;
    name: string;
    type: GraphType;
    property: any;
    sources: GraphSource[] = [];

    constructor(_type: GraphType, _id?: string, _name?: string) {
        this.type = _type;
        this.id = _id;
        this.name = _name;
        if (this.type === GraphType.bar) {
            this.property = new GraphBarProperty();
        }
    }
}

export enum GraphRangeType {
    last1h = 'graph.rangetype-last1h',
    last1d = 'graph.rangetype-last1d',
    last3d = 'graph.rangetype-last3d',
    last1w = 'graph.rangetype-last1w'
}

export enum GraphDateGroupType {
    hours = 'graph.grouptype-hours',
    days = 'graph.grouptype-days',
}

export class GraphBarProperty {
    xtype: GraphBarXType;
    function: GraphBarFunction;
    constructor(_xtype?: GraphBarXType) {
        if (_xtype) {
            this.xtype = _xtype;
        } else {
            this.xtype = <GraphBarXType>Object.keys(GraphBarXType).find(key => GraphBarXType[key] === GraphBarXType.value);
        }
    }
}

export class GraphBarFunction {
    type: any;
}

export class GraphBarDateFunction extends GraphBarFunction {
    type: GraphBarDateFunctionType;

    constructor(_type?: GraphBarDateFunctionType) {
        super();
        if (_type) {
            this.type = _type;
        } else {
            this.type = <GraphBarDateFunctionType>Object.keys(GraphBarDateFunctionType).find(key => GraphBarDateFunctionType[key] === GraphBarDateFunctionType.sumHourIntegral);
        }
    }
}

export class GraphPieProperty {

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

export enum GraphBarDateFunctionType {
    sumHourIntegral = 'graph.bar-date-fnc-hour-integral',
    sumValueIntegral = 'graph.bar-date-fnc-value-integral',
}
