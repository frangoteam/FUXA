import {Component, Input, OnInit} from '@angular/core';
import {GaugeBaseComponent} from '../../gauge-base/gauge-base.component'
import {GaugeAction, GaugeSettings, GaugeStatus, Variable} from '../../../_models/hmi';
import {Utils} from '../../../_helpers/utils';
import {GaugeDialogType} from '../../gauge-property/gauge-property.component';

declare var SVG: any;

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

  static actionsType = {
    hide: 'shapes.action-hide',
    show: 'shapes.action-show',
  }

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

  static getDialogType(): GaugeDialogType {
    return GaugeDialogType.Range;
  }

  static getActions() {
    return this.actionsType;
  }

  static initElement(gab: GaugeSettings) {
    let ele = document.getElementById(gab.id);
    if (ele && gab.property) {
      let htmlButton = Utils.searchTreeStartWith(ele, this.prefixB);
      if (htmlButton) {
        htmlButton.innerHTML = (gab.name) ? gab.name : '<span>&nbsp;</span>';
      }
    }
  }

  static initElementColor(bkcolor, color, ele) {
    let htmlButton = Utils.searchTreeStartWith(ele, this.prefixB);
    if (htmlButton) {
      ele.setAttribute('fill', 'rgba(0, 0, 0, 0)');
      ele.setAttribute('stroke', 'rgba(0, 0, 0, 0)');
      for (let i = 0; i < ele.children.length; i++) {
        ele.children[i].removeAttribute('fill');
        ele.children[i].removeAttribute('stroke');
      }
      if (bkcolor) {
        htmlButton.style.backgroundColor = bkcolor;
      }
      if (color) {
        htmlButton.style.color = color;
      }
    }
  }

  static processValue(ga: GaugeSettings, svgele: any, sig: Variable, gaugeStatus: GaugeStatus) {
    if (svgele.node && svgele.node.children && svgele.node.children.length >= 1) {
      let button = Utils.searchTreeStartWith(svgele.node, this.prefixB);
      let clr = '';
      let val = parseFloat(sig.value);
      if (Number.isNaN(val)) {
        // maybe boolean
        val = Number(sig.value);
      }
      if (ga.property && ga.property.ranges) {
        for (let idx = 0; idx < ga.property.ranges.length; idx++) {
          if (ga.property.ranges[idx].min <= val && ga.property.ranges[idx].max >= val) {
            clr = ga.property.ranges[idx].color;
          }
        }
        button.style.backgroundColor = clr;
      }
      // check actions
      if (ga.property.actions) {
        ga.property.actions.forEach(act => {
          if (act.variableId === sig.id) {
            HtmlButtonComponent.processAction(act, svgele, val, gaugeStatus);
          }
        });
      }
    }

  }

  static getFillColor(ele) {
    if (ele.children && ele.children[0]) {
      let htmlButton = Utils.searchTreeStartWith(ele, this.prefixB);
      if (htmlButton) {
        let result = htmlButton.style['background-color'];
        if (!result) {
          result = htmlButton.getAttribute('fill');
        }
        if (result) {
          return result;
        }
      }
    }
    return ele.getAttribute('fill');
  }

  static getStrokeColor(ele) {
    if (ele.children && ele.children[0]) {
      let htmlButton = Utils.searchTreeStartWith(ele, this.prefixB);
      if (htmlButton) {
        let result = htmlButton.style['color'];
        if (!result) {
          result = htmlButton.getAttribute('stroke');
        }
        if (result) {
          return result;
        }
      }
    }
    return ele.getAttribute('stroke');
  }

  static processAction(act: GaugeAction, svgele: any, value: any, gaugeStatus: GaugeStatus) {
    let element = SVG.adopt(svgele.node);
    if (act.range.min <= value && act.range.max >= value) {
      this.runAction(element, act.type, gaugeStatus);
    }
  }

  static runAction(element, type, gaugeStatus: GaugeStatus) {
    if (this.actionsType[type] === this.actionsType.hide) {
      gaugeStatus.actionRef = { type: type, animr: element.hide() };
    } else if (this.actionsType[type] === this.actionsType.show) {
      gaugeStatus.actionRef = { type: type, animr: element.show() };
    }
  }
}
