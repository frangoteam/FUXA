import { Component, OnInit, Input } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component'
import { GaugeSettings, Variable, WindowLink, Event } from '../../../_models/hmi';
import { Utils } from '../../../_helpers/utils';

@Component({
  selector: 'html-input',
  templateUrl: './html-input.component.html',
  styleUrls: ['./html-input.component.css']
})
export class HtmlInputComponent extends GaugeBaseComponent implements OnInit {

  @Input() data: any;

  static TypeTag = 'svg-ext-html_input';
  static LabelTag = 'HtmlInput';
  static prefix = 'I-HXI_';

  constructor() {
    super();
  }

  ngOnInit() {
  }

  static getSignal(pro: any) {
    let res: string[] = [];
    if (pro.variableId) {
      res.push(pro.variableId);
    }
    return res;
  }

  static getHtmlEvents(ga: GaugeSettings): Event {
    let ele = document.getElementById(ga.id);
    if (ele) {
      let input = Utils.searchTreeStartWith(ele, this.prefix);
      if (input) {
        let event = new Event();
        event.dom = input;
        event.type = 'key-enter';
        event.ga = ga;
        return event;
      }
    }
    return null;
  }

  static processValue(ga: GaugeSettings, svgele: any, sig: Variable) {
    if (svgele.node && svgele.node.children && svgele.node.children.length >= 1) {
      let input = Utils.searchTreeStartWith(svgele.node, this.prefix);
      if (input) {
        let val = parseInt(sig.value, 10);
        input.value = val;
      }
    }
  }
}
