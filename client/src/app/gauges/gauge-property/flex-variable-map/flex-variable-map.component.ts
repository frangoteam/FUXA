import {Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges} from '@angular/core';
import {View} from "../../../_models/hmi";

@Component({
  selector: 'flex-variable-map',
  templateUrl: './flex-variable-map.component.html',
  styleUrls: ['./flex-variable-map.component.css']
})
export class FlexVariableMapComponent implements OnInit, OnChanges {
  @Input() view: View;
  @Input() data: any;
  @Input() value: any;
  @Input() fromVariables: any = [];
  @Output() valueChange: EventEmitter<any> = new EventEmitter();

  constructor() {
    console.log('FlexVariableMapComponent.constructor')
  }

  ngOnInit() {
    console.log(this.fromVariables);
    if (!this.value) {
      this.value = {};
    }
    this.value.from = this.value.from || {}
    this.value.to = this.value.to || {}
  }

  ngOnChanges(changes: SimpleChanges) {
    console.log('FlexVariableMapComponent.ngOnChanges', changes)
  }

  onValueChange() {
    console.log('FlexVariableMapComponent.onValueChange')
    this.valueChange.emit(this.value);
  }

  compareVariables(v1, v2) {
    return v1 && v2 && v1.variableId == v2.variableId;
  }
}
