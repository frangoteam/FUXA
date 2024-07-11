import { Component } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component';
import { GaugeSettings, Variable, GaugeStatus, GaugeAction, GaugeActionsType, GaugeRangeProperty } from '../../../_models/hmi';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';

import { Utils } from '../../../_helpers/utils';

declare var SVG: any;

@Component({
    selector: 'gauge-value',
    templateUrl: './value.component.html',
    styleUrls: ['./value.component.css']
})
export class ValueComponent extends GaugeBaseComponent {


    static TypeTag = 'svg-ext-value';
    static LabelTag = 'Value';

    static actionsType = { hide: GaugeActionsType.hide, show: GaugeActionsType.show, blink: GaugeActionsType.blink };

    constructor() {
        super();
    }

    static getSignals(pro: any) {
        let res: string[] = [];
        if (pro.actions && pro.actions.length) {
            pro.actions.forEach(act => {
                res.push(act.variableId);
            });
        }
        if (pro.ranges) {
            pro.ranges.forEach((range: GaugeRangeProperty) => {
                if (range.textId) {
                    res.push(range.textId);
                }
                if (range['fractionDigitsId']) {
                    res.push(range['fractionDigitsId']);
                }
            });
        }
        if (pro.variableId) {
            res.push(pro.variableId);
        }
        return res;
    }

    static getDialogType(): GaugeDialogType {
        return GaugeDialogType.ValueAndUnit;
    }

    static getActions(type: string) {
        return this.actionsType;
    }

    static processValue(ga: GaugeSettings, svgele: any, sig: Variable, gaugeStatus: GaugeStatus) {
        try {
            if (svgele.node && svgele.node.children && svgele.node.children.length <= 1) {
                let g = svgele.node.children[0];
                let val: any = parseFloat(sig.value);
                switch(typeof(sig.value)){
                    case 'undefined':
                        break;
                    case 'boolean':
                        val = Number(sig.value);
                        break;
                    case 'number':
                        val = parseFloat(val.toFixed(5));
                        break;
                    case 'string':
                        val = sig.value;
                        break;
                    default: break;
                }
                if (ga.property) {
                    let unit = GaugeBaseComponent.getUnit(ga.property, gaugeStatus);
                    let digit = GaugeBaseComponent.getDigits(ga.property, gaugeStatus);

                    if (!Utils.isNullOrUndefined(digit) && Utils.isNumeric(val)) {
                        val = parseFloat(sig.value).toFixed(digit);
                    }
                    if (ga.property.variableId === sig.id) {
                        try {
                            g.textContent = val;
                            if (unit) {
                                g.textContent += ' ' + unit;
                            }
                        } catch (err) {
                            console.error(ga, sig, err);
                        }
                    }
                    // check actions
                    if (ga.property.actions) {
                        ga.property.actions.forEach(act => {
                            if (act.variableId === sig.id) {
                                ValueComponent.processAction(act, svgele, parseFloat(val), gaugeStatus);
                            }
                        });
                    }
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    static processAction(act: GaugeAction, svgele: any, value: any, gaugeStatus: GaugeStatus) {
        if (this.actionsType[act.type] === this.actionsType.hide) {
            if (act.range.min <= value && act.range.max >= value) {
                let element = SVG.adopt(svgele.node);
                this.runActionHide(element, act.type, gaugeStatus);
            }
        } else if (this.actionsType[act.type] === this.actionsType.show) {
            if (act.range.min <= value && act.range.max >= value) {
                let element = SVG.adopt(svgele.node);
                this.runActionShow(element, act.type, gaugeStatus);
            }
        } else if (this.actionsType[act.type] === this.actionsType.blink) {
            let element = SVG.adopt(svgele.node.children[0]);
            let inRange = (act.range.min <= value && act.range.max >= value);
            this.checkActionBlink(element, act, gaugeStatus, inRange, false);
        }
    }
}

export class ValueProperty {
    signalid = '';
    format = '##.##';
}
