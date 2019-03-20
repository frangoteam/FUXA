import { Component, OnInit, Input } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component'
import { GaugeSettings, Variable, WindowLink, Event } from '../../../_models/hmi';
import { Utils } from '../../../_helpers/utils';

@Component({
  selector: 'html-button',
  templateUrl: './html-button.component.html',
  styleUrls: ['./html-button.component.css']
})
export class HtmlButtonComponent extends GaugeBaseComponent implements OnInit {

  @Input() data: any;

  static TypeTag = 'svg-ext-html_button';
  static LabelTag = 'HtmlButton';
  static prefixB = 'B-HXB_';
  static prefixRect = 'svg_';

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

  static initElement(gab: GaugeSettings) {
    let ele = document.getElementById(gab.id);
    if (ele && gab.property) {
      let htmlButton = Utils.searchTreeStartWith(ele, this.prefixB);
      if (htmlButton) {
        htmlButton.innerHTML = gab.name;
      //   htmlLabel.style.display = (gap.style[0]) ? 'block' : 'none';
      }
    }
  }

  static initElementColor(bkcolor, color, ele) {
      let htmlButton = Utils.searchTreeStartWith(ele, this.prefixB);
      if (htmlButton) {
        if (bkcolor) {
          htmlButton.style.backgroundColor = bkcolor;
        }
        if (color) {
          htmlButton.style.color = color;
        }

        // htmlButton.innerHTML = gab.name;
      //   htmlLabel.style.display = (gap.style[0]) ? 'block' : 'none';
      }
  }

  static processValue(ga: GaugeSettings, svgele: any, sig: Variable) {
    // if (svgele.node && svgele.node.children && svgele.node.children.length >= 1) {
    //   let input = Utils.searchTreeStartWith(svgele.node, this.prefix);
    //   if (input) {
    //     let val = parseInt(sig.value, 10);
    //     input.value = val;
    //   }
    // }
  }

  static getFillColor(ele) {
    if (ele.children && ele.children[0]) {
      let htmlButton = Utils.searchTreeStartWith(ele, this.prefixRect);
      if (htmlButton) {
        return htmlButton.getAttribute('fill');
      }
    }
    return ele.getAttribute('fill');
  }

  static getStrokeColor(ele) {
    if (ele.children && ele.children[0]) {
      let htmlButton = Utils.searchTreeStartWith(ele, this.prefixRect);
      if (htmlButton) {
        return htmlButton.getAttribute('stroke');
      }
    }
    return ele.getAttribute('stroke');
  }
}
