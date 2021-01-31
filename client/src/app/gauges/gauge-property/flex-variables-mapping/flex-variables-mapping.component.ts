import {Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges} from '@angular/core';
import {View} from "../../../_models/hmi";

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
    console.log('FlexVariablesMappingComponent.constructor');
  }

  ngOnInit() {
    console.log('FlexVariablesMappingComponent.ngOnInit', this.mapping)
    if (!this.mapping) {
      this.mapping = [];
    }
  }

  ngOnChanges(changes: SimpleChanges) {

    if (changes.view) {
      console.log('FlexVariablesMappingComponent.ngOnChanges', changes);
      this.viewVariables = null;
    }
  }

  get viewVars() {
    console.log('FlexVariablesMappingComponent.viewVariables');

    if (this.viewVariables) {
      return this.viewVariables;
    }
    this.viewVariables = []
    Object.values(this.view.items).forEach((item) => {
      if (item && item.property) {
        if (item.property.variableId) {
          this.viewVariables.push(this.fetchVariable(item.property));
        }
        Object.values(item.property.actions).forEach((action) => {
          this.viewVariables.push(this.fetchVariable(action));
        });
        Object.values(item.property.events).forEach((event) => {
          if (event['actoptions'] && event['actoptions']['variableId']) {
            this.viewVariables.push(this.fetchVariable(event['actoptions']));
          } else if (event['actoptions'] && event['actoptions']['variable']) {
            this.viewVariables.push(event['actoptions']['variable']);
          }
        });
      }
    })
    this.viewVariables = this.viewVariables.filter((elem, pos, arr) => {
      return arr.indexOf(elem) == pos;
    });
    return this.viewVariables;
  }

  protected fetchVariable(object) {
    return {
      variableId: object['variableId'],
      variableSrc: object['variableSrc'],
      variable: object['variable']
    }
  }

  addVariableMapping($event) {
    $event.preventDefault();
    this.mapping.push({from: {}, to: {}})
  }

  removeVariableMapping($event, i) {
    $event.preventDefault();
    this.mapping.splice(i, 1)
  }

  public onChange() {
    console.log('FlexVariablesMappingComponent.onChange', this.mapping)
    this.mappingChange.emit(this.mapping);
  }
}
