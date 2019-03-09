import { Component, OnInit, AfterViewInit, Input } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component'
import { GaugeSettings, Variable, WindowLink, GaugeEvent, GaugeEventType, GaugeProperty } from '../../../_models/hmi';

@Component({
  selector: 'gauge-compressor',
  templateUrl: './compressor.component.html',
  styleUrls: ['./compressor.component.css']
})
export class CompressorComponent extends GaugeBaseComponent implements OnInit, AfterViewInit {

  @Input() data: any;

  static TypeTag = 'svg-ext-compressor';
  static LabelTag = 'Compressor';

  constructor() {
    super();
   }

   ngOnInit() {
    if (!this.data) {
      // this.settings.property = new CompressorProperty();
    }
    // let property = JSON.stringify(this.settings.property);
    // this.settings.id = '';
  }

  ngAfterViewInit() {
  }

  static getSignals(pro: any) {
    let res: string[] = [];
    if (pro.variableId) {
      res.push(pro.variableId);
    }
    if (pro.alarmId) {
      res.push(pro.alarmId);
    }
    return res;
  }

  static processValue(ga: GaugeSettings, svgele: any, sig: Variable) {
    if (svgele.node && svgele.node.children && svgele.node.children.length <= 1) {
      let g = svgele.node.children[0];
      let clr = '';
      let val = parseInt(sig.value, 10);
      if (ga.property && ga.property.ranges) {
        for (let idx = 0; idx < ga.property.ranges.length; idx++) {
          if (ga.property.ranges[idx].min <= val && ga.property.ranges[idx].max >= val) {
            clr = ga.property.ranges[idx].color;
          }
        }
        g.setAttribute('fill', clr);      
      }
      if (ga.property.alarmId === sig.id && ga.property.alarmColor && val > 0) {
        g.setAttribute('fill', ga.property.alarmColor);      
      }
    }
  }  
}
