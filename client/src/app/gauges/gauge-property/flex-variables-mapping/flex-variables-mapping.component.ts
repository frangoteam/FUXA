import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { View } from "../../../_models/hmi";

@Component({
    selector: 'flex-variables-mapping',
    templateUrl: './flex-variables-mapping.component.html',
    styleUrls: ['./flex-variables-mapping.component.css']
})
export class FlexVariablesMappingComponent implements OnInit, OnChanges {
    @Input() view: View;
    @Input() mapping: any;
    @Input() data: any;
    @Output() mappingChange: EventEmitter<any> = new EventEmitter();

    public viewVariables;

    constructor() {
    }

    ngOnInit() {
        if (!this.mapping) {
            this.mapping = [];
        }
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes.view) {
            this.viewVariables = null;
        }
    }

    get viewVars() {
        if (this.viewVariables) {
            return this.viewVariables;
        }
        let viewVariables = {}
        Object.values(this.view.items).forEach((item) => {
            if (item && item.property) {
                if (item.property.variableId) {
                    this.assignVariableTo(item.property, viewVariables)
                }
                Object.values(item.property.actions).forEach((action) => {
                    this.assignVariableTo(action, viewVariables);
                });
                Object.values(item.property.events).forEach((event) => {
                    if (event['actoptions'] && event['actoptions']['variableId']) {
                        this.assignVariableTo(event['actoptions'], viewVariables);
                    } else if (event['actoptions'] && event['actoptions']['variable']) {
                        this.assignVariableTo(event['actoptions']['variable'], viewVariables);
                    }
                });
            }
        })
        this.viewVariables = Object.values(viewVariables)
        return this.viewVariables;
    }

    protected assignVariableTo(object, target) {
        let variable = {
            variableId: object['variableId'],
            variableSrc: object['variableSrc'],
            variable: object['variable']
        }
        target[variable.variableId] = variable
    }

    addVariableMapping($event) {
        $event.preventDefault();
        this.mapping.push({ from: {}, to: {} })
    }

    removeVariableMapping($event, i) {
        $event.preventDefault();
        this.mapping.splice(i, 1)
    }

    public onChange() {
        this.mappingChange.emit(this.mapping);
    }
}
