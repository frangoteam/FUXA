import { Component, OnInit, Input } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component'
import { GaugeSettings, Variable, GaugeStatus, WindowLink, Event } from '../../../_models/hmi';
import { Utils } from '../../../_helpers/utils';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';

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

    static getSignals(pro: any) {
        let res: string[] = [];
        if (pro.variableId) {
            res.push(pro.variableId);
        }
        return res;
    }

    static getDialogType(): GaugeDialogType {
        return GaugeDialogType.OnlyValue;
    }

    static initElement(gab: GaugeSettings) {
        let ele = document.getElementById(gab.id);
        if (ele && gab.property) {
            let htmlButton = Utils.searchTreeStartWith(ele, this.prefixB);
            if (htmlButton) {
                htmlButton.innerHTML = (gab.name) ? gab.name : '<span>&nbsp;</span>';
                //   htmlLabel.style.display = (gap.style[0]) ? 'block' : 'none';
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

            // htmlButton.innerHTML = gab.name;
            //   htmlLabel.style.display = (gap.style[0]) ? 'block' : 'none';
        }
    }

    static processValue(ga: GaugeSettings, svgele: any, sig: Variable, gaugeStatus: GaugeStatus) {
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
}
