import { Component, Input, OnInit } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component'
import { GaugeSettings, GaugeStatus, Variable } from '../../../_models/hmi';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';

@Component({
    selector: 'gauge-semaphore',
    templateUrl: './gauge-semaphore.component.html',
    styleUrls: ['./gauge-semaphore.component.css']
})
export class GaugeSemaphoreComponent extends GaugeBaseComponent implements OnInit {

    @Input() data: any;

    static TypeTag = 'svg-ext-gauge_semaphore';
    static LabelTag = 'HtmlSemaphore';

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

    static processValue(ga: GaugeSettings, svgele: any, sig: Variable, gaugeStatus: GaugeStatus) {
        if (svgele.node && svgele.node.children && svgele.node.children.length <= 1) {
            let g = svgele.node.children[0];
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
                g.setAttribute('fill', clr);
            }
        }
    }

    static getFillColor(ele) {
        if (ele.children && ele.children[0]) {
            return ele.children[0].getAttribute('fill');
        }
        return ele.getAttribute('fill');
    }

    static getStrokeColor(ele) {
        if (ele.children && ele.children[0]) {
            return ele.children[0].getAttribute('stroke');
        }
        return ele.getAttribute('stroke');
    }
}
