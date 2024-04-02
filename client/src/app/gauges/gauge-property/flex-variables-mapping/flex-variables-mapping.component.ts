import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';

import { View } from '../../../_models/hmi';

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

    public placeholders;

    constructor() {
    }

    ngOnInit() {
        if (!this.mapping) {
            this.mapping = [];
        }
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes.view) {
            this.placeholders = null;
        }
    }

    get viewPlaceholders() {
        if (this.placeholders) {
            return this.placeholders;
        }
        let viewVariables = {};
        if (this.view) {
            Object.values(this.view.items).forEach((item) => {
                if (item && item.property) {
                    if (item.property.variableId) {
                        this.assignVariableTo(item.property, viewVariables);
                    }
                    if (item.property.actions) {
                        Object.values(item.property.actions).forEach((action) => {
                            this.assignVariableTo(action, viewVariables);
                        });
                    }
                    if (item.property.events) {
                        Object.values(item.property.events).forEach((event) => {
                            if (event['actoptions'] && event['actoptions']['variableId']) {
                                this.assignVariableTo(event['actoptions'], viewVariables);
                            } else if (event['actoptions'] && event['actoptions']['variable']) {
                                this.assignVariableTo(event['actoptions']['variable'], viewVariables);
                            }
                        });
                    }
                }
            });
        }
        this.placeholders = Object.values(viewVariables);
        return this.placeholders;
    }

    protected assignVariableTo(object, target) {
        let variable = {
            variableId: object['variableId']
        };
        target[variable.variableId] = variable;
    }

    addVariableMapping($event) {
        $event.preventDefault();
        this.mapping.push({ from: {}, to: {} });
    }

    removeVariableMapping($event, i) {
        $event.preventDefault();
        this.mapping.splice(i, 1);
    }

    public onChange() {
        this.mappingChange.emit(this.mapping);
    }
}
