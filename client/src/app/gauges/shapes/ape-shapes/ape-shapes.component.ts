import { Component } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component'
import { GaugeSettings, GaugeAction, Variable } from '../../../_models/hmi';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';

declare var SVG: any;

@Component({
    selector: 'ape-shapes',
    templateUrl: './ape-shapes.component.html',
    styleUrls: ['./ape-shapes.component.css']
})
export class ApeShapesComponent extends GaugeBaseComponent {

    static TypeId = 'ape';
    static TypeTag = 'svg-ext-' + ApeShapesComponent.TypeId;      // used to identify shapes type, binded with the library svgeditor
    static LabelTag = 'AnimProcEng';

    static actionsType = {
        stop: 'shapes.action-stop',
        clockwise: 'shapes.action-clockwise',
        anticlockwise: 'shapes.action-anticlockwise'
    }

    constructor() {
        super();
    }

    static getSignals(pro: any) {
        let res: string[] = [];
        if (pro.variableId) {
            res.push(pro.variableId);
        }
        if (pro.alarmId) {
            res.push(pro.alarmId);
        }
        if (pro.actions) {
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

    static processValue(ga: GaugeSettings, svgele: any, sig: Variable) {
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
                            ApeShapesComponent.processAction(act, svgele, value);
                        }
                    });
                }
            }
        }
    }

    static processAction(act: GaugeAction, svgele: any, value: any) {
        var element = SVG.adopt(svgele.node);
        if (act.range.min <= value && act.range.max >= value) {
            ApeShapesComponent.runAction(element, act.type);
        }
    }

    static runAction(element, type) {
        element.stop(true);
        if (ApeShapesComponent.actionsType[type] === ApeShapesComponent.actionsType.clockwise) {
            element.animate(3000).rotate(365).loop();
        } else if (ApeShapesComponent.actionsType[type] === ApeShapesComponent.actionsType.anticlockwise) {
            element.animate(3000).rotate(-365).loop();
        } 
    }
}
