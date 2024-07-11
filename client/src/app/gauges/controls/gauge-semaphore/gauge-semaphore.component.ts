import { Component } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component';
import { GaugeSettings, GaugeStatus, Variable, GaugeActionsType, GaugeAction } from '../../../_models/hmi';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';

declare var SVG: any;

@Component({
    selector: 'gauge-semaphore',
    templateUrl: './gauge-semaphore.component.html',
    styleUrls: ['./gauge-semaphore.component.css']
})
export class GaugeSemaphoreComponent extends GaugeBaseComponent {


    static TypeTag = 'svg-ext-gauge_semaphore';
    static LabelTag = 'HtmlSemaphore';

    static actionsType = { hide: GaugeActionsType.hide, show: GaugeActionsType.show, blink: GaugeActionsType.blink };

    constructor() {
        super();
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
        return GaugeDialogType.Range;
    }

    static getActions() {
        return this.actionsType;
    }

    static processValue(ga: GaugeSettings, svgele: any, sig: Variable, gaugeStatus: GaugeStatus) {
        try {
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
                    // check actions
                    if (ga.property.actions) {
                        ga.property.actions.forEach(act => {
                            if (act.variableId === sig.id) {
                                GaugeSemaphoreComponent.processAction(act, svgele, val, gaugeStatus);
                            }
                        });
                    }
                }
            }
        } catch (err) {
            console.error(err);
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
            let element = SVG.adopt(svgele.node);
            let inRange = (act.range.min <= value && act.range.max >= value);
            this.checkActionBlink(element, act, gaugeStatus, inRange, false);
        }
    }
}
