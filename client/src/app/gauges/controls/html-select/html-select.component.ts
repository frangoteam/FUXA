import { Component, OnInit, Input } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component'
import { GaugeSettings, Variable, WindowLink, Event } from '../../../_models/hmi';
import { Utils } from '../../../_helpers/utils';

@Component({
  selector: 'html-select',
  templateUrl: './html-select.component.html',
  styleUrls: ['./html-select.component.css']
})
export class HtmlSelectComponent extends GaugeBaseComponent implements OnInit {

  @Input() data: any;

  static TypeTag = 'svg-ext-html_select';
  static LabelTag = 'HtmlSelect';
  static prefix = 'S-HXS_';

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
      let select = Utils.searchTreeStartWith(ele, this.prefix);
      if (select) {
        let event = new Event();
        event.dom = select;
        event.type = 'change';
        event.ga = ga;
        return event;
      }
    }
    return null;
  }

  static processValue(ga: GaugeSettings, svgele: any, sig: Variable) {
    let select = Utils.searchTreeStartWith(svgele.node, this.prefix);
    if (select) {
      let val = parseInt(sig.value, 10);
      select.value = val;
    }
  }

  static initElement(ga: GaugeSettings) {
    let ele = document.getElementById(ga.id);
    if (ele) {
      let select = Utils.searchTreeStartWith(ele, this.prefix);
      if (select) {
        select.innerHTML = "";
        ga.property.ranges.forEach(element => {
          let option = document.createElement("option");
          option.value = element.min;
          if (element.text) {
            option.text = element.text;
          }
          select.appendChild(option);
        });
      }
    }    
  }
}
