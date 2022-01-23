
import { Component } from '@angular/core';
import { GraphType, GraphSource } from '../../../../_models/graph';
@Component({
    template: ''
})
export class GraphBaseComponent {
    id: string;
    isEditor: boolean;

    init? (property: any, sources?: GraphSource[]): void;
    setOptions? (options: any): void;
    addDataSet? (sigid: string, signame: string, source: any): void;
    setValue? (sigid: string, timestamp: any, sigvalue: any): void;
}