export class Graph {
    id: string;
    name: string;
    type: GraphType;
    sources: GraphSource[];
}

export class GraphSource {
    device: string;
    id: string;
    name: string;
    label: string;
    // color: string;
    // fill?: string;
}

export enum GraphType {
    bar,
    pie
}