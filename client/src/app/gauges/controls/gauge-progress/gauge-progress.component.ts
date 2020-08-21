import { Component, OnInit, Input } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component'
import { GaugeSettings, Variable, GaugeRangeProperty, GaugeStatus, WindowLink, Event, GaugeProperty } from '../../../_models/hmi';
import { Utils } from '../../../_helpers/utils';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';

@Component({
    selector: 'gauge-progress',
    templateUrl: './gauge-progress.component.html',
    styleUrls: ['./gauge-progress.component.css']
})
export class GaugeProgressComponent extends GaugeBaseComponent implements OnInit {

    @Input() data: any;

    static TypeTag = 'svg-ext-gauge_progress';
    static LabelTag = 'HtmlProgress';
    static prefixA = 'A-GXP_';
    static prefixB = 'B-GXP_';
    static prefixH = 'H-GXP_';
    static prefixMax = 'M-GXP_';
    static prefixMin = 'm-GXP_';
    static prefixValue = 'V-GXP_';
    static barColor = '#1565c0';

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
        return GaugeDialogType.MinMax;
    }

    static processValue(ga: GaugeSettings, svgele: any, sig: Variable, gaugeStatus: GaugeStatus) {
        if (svgele.node && svgele.node.children && svgele.node.children.length === 3 && ga.property && ga.property.ranges.length > 0) {
            let gap: GaugeRangeProperty = ga.property.ranges[0];
            let g = svgele.node.children[0];
            let val = parseFloat(sig.value);
            let rectBase = Utils.searchTreeStartWith(svgele.node, this.prefixA);
            let heightBase = parseFloat(rectBase.getAttribute('height'));
            let yBase = parseFloat(rectBase.getAttribute('y'));
            let rect = Utils.searchTreeStartWith(svgele.node, this.prefixB);
            if (rectBase && rect) {
                if (val > gap.max) val = gap.max;
                if (val < gap.min) val = gap.min;
                let k = (heightBase - 0) / (gap.max - gap.min);
                let vtoy = k * (val - gap.min);
                rect.setAttribute('y', yBase + heightBase - vtoy);
                rect.setAttribute('height', vtoy);
                if (gap.style[1]) {
                    let htmlValue = Utils.searchTreeStartWith(svgele.node, this.prefixValue);
                    if (htmlValue) {
                        htmlValue.innerHTML = val;
                        if (gap.text) {
                            htmlValue.innerHTML += ' ' + gap.text;
                        }
                        htmlValue.style.top = (heightBase - vtoy - 7).toString() + 'px';
                    }
                }
            }
        }
    }

    static initElement(ga: GaugeSettings, isview: boolean = false) {
        let ele = document.getElementById(ga.id);
        if (ele) {
            if (!ga.property) {
                ga.property = new GaugeProperty();
                let ip: GaugeRangeProperty = new GaugeRangeProperty();
                ip.type = this.getDialogType();
                ip.min = 0;
                ip.max = 100;
                ip.style = [true, true];
                ip.color = '#1565c0';
                ga.property.ranges = [ip];
            }
            if (ga.property.ranges.length > 0) {
                let gap: GaugeRangeProperty = ga.property.ranges[0];
                // label min
                let htmlLabel = Utils.searchTreeStartWith(ele, this.prefixMin);
                if (htmlLabel) {
                    htmlLabel.innerHTML = gap.min.toString();
                    htmlLabel.style.display = (gap.style[0]) ? 'block' : 'none';
                }
                // label max
                htmlLabel = Utils.searchTreeStartWith(ele, this.prefixMax);
                if (htmlLabel) {
                    htmlLabel.innerHTML = gap.max.toString();
                    htmlLabel.style.display = (gap.style[0]) ? 'block' : 'none';
                }
                // value
                let htmlValue = Utils.searchTreeStartWith(ele, this.prefixValue);
                if (htmlValue) {
                    htmlValue.style.display = (gap.style[1]) ? 'block' : 'none';
                }
                // bar color
                let rect = Utils.searchTreeStartWith(ele, this.prefixB);
                if (rect) {
                    rect.setAttribute('fill', gap.color);
                }
            }
        }
    }

    static initElementColor(bkcolor, color, ele) {
        let rectArea = Utils.searchTreeStartWith(ele, this.prefixA);
        if (rectArea) {
            if (bkcolor) {
                rectArea.setAttribute('fill', bkcolor);
            }
            if (color) {
                rectArea.setAttribute('stroke', color);
            }
        }
        rectArea = Utils.searchTreeStartWith(ele, this.prefixB);
        if (rectArea) {
            if (color) {
                rectArea.setAttribute('stroke', color);
            }
        }
    }

    static getFillColor(ele) {
        let rectArea = Utils.searchTreeStartWith(ele, this.prefixA);
        if (rectArea) {
            return rectArea.getAttribute('fill');
        }
    }

    static getStrokeColor(ele) {
        let rectArea = Utils.searchTreeStartWith(ele, this.prefixA);
        if (rectArea) {
            return rectArea.getAttribute('stroke');
        }
    }

    static getDefaultValue() {
        return { color: this.barColor };
    }
}
