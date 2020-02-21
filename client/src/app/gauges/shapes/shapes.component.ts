import { Component, OnInit } from '@angular/core';
import { GaugeBaseComponent } from '../gauge-base/gauge-base.component'
import { GaugeSettings, Variable } from '../../_models/hmi';
import { GaugeDialogType } from '../gauge-property/gauge-property.component';

@Component({
    selector: 'gauge-shapes',
    templateUrl: './shapes.component.html',
    styleUrls: ['./shapes.component.css']
})
export class ShapesComponent extends GaugeBaseComponent implements OnInit {

    static TypeId = 'shapes';
    static TypeTag = 'svg-ext-' + ShapesComponent.TypeId;      // used to identify shapes type, binded with the library svgeditor
    static LabelTag = 'Shapes';

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
        if (pro.alarmId) {
            res.push(pro.alarmId);
        }
        return res;
    }

    static getDialogType(): GaugeDialogType {
        return GaugeDialogType.RangeWithAlarm;
    }

    static processValue(ga: GaugeSettings, svgele: any, sig: Variable) {
        if (svgele.node) {
            let clr = '';
            let val = parseFloat(sig.value);
            if (Number.isNaN(val)) {
                // maybe boolean
                val = Number(sig.value);
            } else {
                val = parseFloat(val.toFixed(5));
            }
            if (ga.property && ga.property.ranges) {
                for (let idx = 0; idx < ga.property.ranges.length; idx++) {
                    if (ga.property.ranges[idx].min <= val && ga.property.ranges[idx].max >= val) {
                        clr = ga.property.ranges[idx].color;
                    }
                }
                svgele.node.setAttribute('fill', clr);
            }
        }
    }
}
