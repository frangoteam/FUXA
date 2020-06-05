import { Component, OnInit } from '@angular/core';
import { GaugeBaseComponent } from '../gauge-base/gauge-base.component'
import { GaugeSettings, GaugeAction, Variable, GaugeStatus } from '../../_models/hmi';
import { GaugeDialogType } from '../gauge-property/gauge-property.component';

declare var SVG: any;

@Component({
    selector: 'gauge-shapes',
    templateUrl: './shapes.component.html',
    styleUrls: ['./shapes.component.css']
})
export class ShapesComponent extends GaugeBaseComponent implements OnInit {

    static TypeId = 'shapes';
    static TypeTag = 'svg-ext-' + ShapesComponent.TypeId;      // used to identify shapes type, binded with the library svgeditor
    static LabelTag = 'Shapes';

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
        if (pro.alarmId) {
            res.push(pro.alarmId);
        }
        if (pro.actions && pro.actions.length) {
            pro.actions.forEach(act => {
                res.push(act.variableId);
            });
        }
        return res;
    }

    static getActions() {
        return this.actionsType;
    }

    static getDialogType(): GaugeDialogType {
        return GaugeDialogType.RangeWithAlarm;
    }

    static processValue(ga: GaugeSettings, svgele: any, sig: Variable, gaugeStatus: GaugeStatus) {
        if (svgele.node) {
            let clr = '';
            let value = parseFloat(sig.value);
            if (Number.isNaN(value)) {
                // maybe boolean
                value = Number(sig.value);
            } else {
                value = parseFloat(value.toFixed(5));
            }
            if (ga.property) {
                if (ga.property.variableId === sig.id && ga.property.ranges) {
                    for (let idx = 0; idx < ga.property.ranges.length; idx++) {
                        if (ga.property.ranges[idx].min <= value && ga.property.ranges[idx].max >= value) {
                            clr = ga.property.ranges[idx].color;
                        }
                    }
                    if (clr) {
                        svgele.node.setAttribute('fill', clr);
                    }
                }
                // check actions
                if (ga.property.actions) {
                    ga.property.actions.forEach(act => {
                        if (act.variableId === sig.id) {
                            ShapesComponent.processAction(act, svgele, value, gaugeStatus);
                        }
                    });
                }                
            }
        }
    }

    static processAction(act: GaugeAction, svgele: any, value: any, gaugeStatus: GaugeStatus) {
        var element = SVG.adopt(svgele.node);
        if (act.range.min <= value && act.range.max >= value) {
            ShapesComponent.runAction(element, act.type, gaugeStatus);
        }
    }

    static runAction(element, type, gaugeStatus: GaugeStatus) {
        if (ShapesComponent.actionsType[type] === ShapesComponent.actionsType.hide) {
            gaugeStatus.actionRef = { type: type, animr: element.hide() };
        } else if (ShapesComponent.actionsType[type] === ShapesComponent.actionsType.show) {
            gaugeStatus.actionRef = { type: type, animr: element.show() };
        }
    }
}
