import { Component, Inject, OnInit, Input, AfterViewInit } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component'
import { GaugeSettings, Variable, GaugeStatus, GaugeAction, GaugeActionsType } from '../../../_models/hmi';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';

import { Utils } from '../../../_helpers/utils';

declare var SVG: any;

@Component({
    selector: 'gauge-value',
    templateUrl: './value.component.html',
    styleUrls: ['./value.component.css']
})
export class ValueComponent extends GaugeBaseComponent implements OnInit {

    @Input() data: any;

    static TypeTag = 'svg-ext-value';
    static LabelTag = 'Value';

    static actionsType = { hide: GaugeActionsType.hide, show: GaugeActionsType.show, blink: GaugeActionsType.blink };

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
        if (pro.actions && pro.actions.length) {
            pro.actions.forEach(act => {
                res.push(act.variableId);
            });
        }
        return res;
    }

    static getDialogType(): GaugeDialogType {
        return GaugeDialogType.ValueAndUnit;
    }

    static getActions() {
        return this.actionsType;
    }
    
    static processValue(ga: GaugeSettings, svgele: any, sig: Variable, gaugeStatus: GaugeStatus) {
        try {
            if (svgele.node && svgele.node.children && svgele.node.children.length <= 1) {
                let g = svgele.node.children[0];
                let val: any = parseFloat(sig.value);
                let isString = false;
                if (Number.isNaN(val)) {
                    // maybe boolean
                    val = Number(sig.value);
                    // maybe string
                    if (Number.isNaN(val)) {
                        val = sig.value;
                        isString = true;
                    }
                } else {
                    val = parseFloat(val.toFixed(5));
                }
                if (ga.property) {
                    let unit = GaugeBaseComponent.getUnit(ga.property, sig.id, val);
                    let digit = GaugeBaseComponent.getDigits(ga.property);
                    if (!isString && !Utils.isNullOrUndefined(digit)) {
                        val = parseFloat(val).toFixed(digit);
                    }
                    if (ga.property.variableId === sig.id) {
                        g.textContent = val;
                        if (unit) {
                            g.textContent += ' ' + unit;
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
            console.log(err);
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
            this.checkActionBlink(element, act.type, gaugeStatus, inRange, act.options, false);
        }
    }
}

export class ValueProperty {
    signalid: string = '';
    format: string = '##.##'
}
