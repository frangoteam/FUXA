/**
 * Shape extension
 */
import { Component } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component'
import { GaugeSettings, GaugeAction, Variable, GaugeStatus, GaugeActionStatus, GaugeActionsType } from '../../../_models/hmi';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';
import { Utils } from '../../../_helpers/utils';

declare var SVG: any;
declare var Raphael: any;

@Component({
    selector: 'ape-shapes',
    templateUrl: './ape-shapes.component.html',
    styleUrls: ['./ape-shapes.component.css']
})
export class ApeShapesComponent extends GaugeBaseComponent {

    static TypeId = 'ape';
    static TypeTag = 'svg-ext-' + ApeShapesComponent.TypeId;      // used to identify shapes type, binded with the library svgeditor
    static LabelTag = 'AnimProcEng';

    static actionsType = { stop: GaugeActionsType.stop, clockwise: GaugeActionsType.clockwise, anticlockwise: GaugeActionsType.anticlockwise, downup: GaugeActionsType.downup,
        hide: GaugeActionsType.hide, show: GaugeActionsType.show };

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

    static processValue(ga: GaugeSettings, svgele: any, sig: Variable, gaugeStatus: GaugeStatus) {
        try {
            if (svgele.node) {
                let value = parseFloat(sig.value);
                if (Number.isNaN(value)) {
                    // maybe boolean
                    value = Number(sig.value);
                } else {
                    value = parseFloat(value.toFixed(5));
                }
                if (ga.property) {
                    if (ga.property.variableId === sig.id && ga.property.ranges) {
                        let fill = null;
                        let stroke = null;
                        for (let idx = 0; idx < ga.property.ranges.length; idx++) {
                            if (ga.property.ranges[idx].min <= value && ga.property.ranges[idx].max >= value) {
                                fill = ga.property.ranges[idx].color;
                                stroke = ga.property.ranges[idx].stroke;
                            }
                        }
                        if (fill) {
                            svgele.node.setAttribute('fill', fill);
                        }
                        if (stroke) {
                            svgele.node.setAttribute('stroke', stroke);
                        }
                    }
                    // check actions
                    if (ga.property.actions) {
                        ga.property.actions.forEach(act => {
                            if (act.variableId === sig.id) {
                                ApeShapesComponent.processAction(act, svgele, value, gaugeStatus);
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
        } else {
            if (act.range.min <= value && act.range.max >= value) {
                var element = SVG.adopt(svgele.node);
                ApeShapesComponent.runMyAction(element, act.type, gaugeStatus);
            }    
        }
    }

    static runMyAction(element, type, gaugeStatus: GaugeStatus) {
        element.stop(true);
        if (ApeShapesComponent.actionsType[type] === ApeShapesComponent.actionsType.clockwise) {
            gaugeStatus.actionRef = <GaugeActionStatus>{ type: type, animr: element.animate(3000).rotate(365).loop() };
        } else if (ApeShapesComponent.actionsType[type] === ApeShapesComponent.actionsType.anticlockwise) {
            gaugeStatus.actionRef = <GaugeActionStatus>{ type: type, animr: element.animate(3000).rotate(-365).loop() };
        } else if (ApeShapesComponent.actionsType[type] === ApeShapesComponent.actionsType.downup) {
            if (gaugeStatus.actionRef && gaugeStatus.actionRef.type === type) {
                return;
            }
            let eletoanim = Utils.searchTreeStartWith(element.node, 'pm');
            if (eletoanim) {
                element = SVG.adopt(eletoanim);
                let elebox = eletoanim.getBBox();
				var movefrom = { x: elebox.x, y: elebox.y };
                var moveto = { x: elebox.x, y: elebox.y  - 25 };
                
                let timeout = setInterval(() => {
                    element.animate(1000).move(moveto.x, moveto.y).animate(1000).move(movefrom.x, movefrom.y);
                }, 2000);
                gaugeStatus.actionRef = <GaugeActionStatus>{ type: type, timer: timeout };
            }
        } else if (ApeShapesComponent.actionsType[type] === ApeShapesComponent.actionsType.stop) {
            if (gaugeStatus.actionRef && gaugeStatus.actionRef.timer) {
                clearTimeout(gaugeStatus.actionRef.timer);
                gaugeStatus.actionRef.timer = null;
            }
        }
    }

    static firstAnimation(element, moveto, movefrom) {
        // element.animate(1000).move(moveto.x, moveto.y).animate(1000).move(movefrom.x, movefrom.y).after(function () {
        //     ApeShapesComponent.firstAnimation(element, moveto, movefrom);
        // });
        element.animate({duration: 1000, delay: 6000, wait: 6000 }).move(moveto.x, moveto.y).after(function () {
        // element.animate(1000).move(movefrom.x, movefrom.y);
        }).loop();//ApeShapesComponent.secondAnimation(element, moveto, movefrom));
    }
    static secondAnimation(element, movefrom, moveto) {
        // element.animate(1000).move(moveto.x, moveto.y).after(ApeShapesComponent.firstAnimation(element, moveto, movefrom));
    }
}
