/**
 * Shape extension
 */
import { Component, ContentChild } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component'
import { GaugeSettings, GaugeAction, Variable, GaugeStatus, GaugeActionStatus, GaugeActionsType, GaugeProperty } from '../../../_models/hmi';
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
    static EliType = ApeShapesComponent.TypeTag + '-eli';
    static PistonType = ApeShapesComponent.TypeTag + '-piston';

    static actionsType: {
        stop: GaugeActionsType.stop;
        hide: GaugeActionsType.hide;
        show: GaugeActionsType.show;
        downup?: GaugeActionsType.downup;
        clockwise?: GaugeActionsType.clockwise;
        anticlockwise?: GaugeActionsType.anticlockwise;
        } = { stop: GaugeActionsType.stop, hide: GaugeActionsType.hide, show: GaugeActionsType.show };

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

    static getActions(type: string, content: any) {
        console.log(content);
        let actions = Object.assign({}, ApeShapesComponent.actionsType);
        content[0].children[1].children.forEach(child => {
            if (child.name === 'clockwise') {
                actions.clockwise = ApeShapesComponent.actionsType.clockwise;
            }
            if (child.name === 'anticlockwise') {
                actions.anticlockwise = ApeShapesComponent.actionsType.anticlockwise;
            }
            if (child.name === 'downup') {
                actions.downup = ApeShapesComponent.actionsType.downup;
            }
        });
        return actions;
    }

    static getDialogType(): GaugeDialogType {
        return GaugeDialogType.RangeWithAlarm;
    }

    static isBitmaskSupported(): boolean {
        return true;
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
                    let propValue = GaugeBaseComponent.checkBitmask((<GaugeProperty>ga.property).bitmask, value);
                    if (ga.property.variableId === sig.id && ga.property.ranges) {
                        let fill = null;
                        let stroke = null;
                        for (let idx = 0; idx < ga.property.ranges.length; idx++) {
                            if (ga.property.ranges[idx].min <= propValue && ga.property.ranges[idx].max >= propValue) {
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
        let actValue = GaugeBaseComponent.checkBitmask(act.bitmask, value);
        if (this.actionsType[act.type] === this.actionsType.hide) {
            if (act.range.min <= actValue && act.range.max >= actValue) {
                let element = SVG.adopt(svgele.node);
                ApeShapesComponent.clearAnimationTimer(gaugeStatus.actionRef);
                this.runActionHide(element, act.type, gaugeStatus);
            }
        } else if (this.actionsType[act.type] === this.actionsType.show) {
            if (act.range.min <= actValue && act.range.max >= actValue) {
                let element = SVG.adopt(svgele.node);
                this.runActionShow(element, act.type, gaugeStatus);
            }
        } else {
            if (act.range.min <= actValue && act.range.max >= actValue) {
                var element = SVG.adopt(svgele.node);
                ApeShapesComponent.runMyAction(element, act.type, gaugeStatus);
            }    
        }
    }

    static runMyAction(element, type, gaugeStatus: GaugeStatus) {
        if (gaugeStatus.actionRef && gaugeStatus.actionRef.type === type) {
            return;
        }
        element.stop(true);
        if (ApeShapesComponent.actionsType[type] === ApeShapesComponent.actionsType.clockwise) {
            gaugeStatus.actionRef = <GaugeActionStatus>{ type: type, animr: element.animate(3000).rotate(365).loop() };
        } else if (ApeShapesComponent.actionsType[type] === ApeShapesComponent.actionsType.anticlockwise) {
            gaugeStatus.actionRef = <GaugeActionStatus>{ type: type, animr: element.animate(3000).rotate(-365).loop() };
        } else if (ApeShapesComponent.actionsType[type] === ApeShapesComponent.actionsType.downup) {
            let eletoanim = Utils.searchTreeStartWith(element.node, 'pm');
            if (eletoanim) {
                element = SVG.adopt(eletoanim);
                let elebox = eletoanim.getBBox();                
				var movefrom = { x: elebox.x, y: elebox.y };
                if (gaugeStatus.actionRef && gaugeStatus.actionRef.spool) {
                    movefrom = gaugeStatus.actionRef.spool;
                }
                var moveto = { x: elebox.x, y: elebox.y  - 25 };
                ApeShapesComponent.clearAnimationTimer(gaugeStatus.actionRef);
                let timeout = setInterval(() => {
                    element.animate(1000).move(moveto.x, moveto.y).animate(1000).move(movefrom.x, movefrom.y);
                }, 2000);
                gaugeStatus.actionRef = <GaugeActionStatus>{ type: type, timer: timeout, spool: movefrom };
            }
        } else if (ApeShapesComponent.actionsType[type] === ApeShapesComponent.actionsType.stop) {
            if (gaugeStatus.actionRef) {
                ApeShapesComponent.clearAnimationTimer(gaugeStatus.actionRef);
                gaugeStatus.actionRef.type = type;
            }
        }
    }
}
