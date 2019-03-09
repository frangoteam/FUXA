import { Component, Inject, OnInit, Input, AfterViewInit } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component'
import { GaugeSettings, Variable } from '../../../_models/hmi';

@Component({
  selector: 'gauge-value',
  templateUrl: './value.component.html',
  styleUrls: ['./value.component.css']
})
export class ValueComponent extends GaugeBaseComponent implements OnInit {

  @Input() data: any;

  static TypeTag = 'svg-ext-value';
  static LabelTag = 'Value';

  constructor() { 
    super();
  }

  ngOnInit() {
  }

  static getSignals(pro: any) {
    let res: string[] = [];
    if (pro.variableId) {
      res.push(pro.variableId);
    }
    return res;
  }
  
  static processValue(ga: GaugeSettings, svgele: any, sig: Variable) {
    // console.log('gaid value: ' + ga.id);
    if (svgele.node && svgele.node.children && svgele.node.children.length <= 1) {
      let g = svgele.node.children[0];
      let val = parseInt(sig.value, 10);
      g.textContent = val;
    }
  }
}

export class ValueProperty {
  signalid: string = '';
  format: string = '##.##'
}
