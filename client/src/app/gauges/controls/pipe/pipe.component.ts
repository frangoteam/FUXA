import { Injectable } from '@angular/core';

import { GaugeSettings, GaugeAction, Variable, GaugeStatus } from '../../../_models/hmi';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';
import { Utils } from '../../../_helpers/utils';

declare var SVG: any;
declare var Raphael: any;

@Injectable()
export class PipeComponent {

    static TypeId = 'pipe';
    static TypeTag = 'svg-ext-' + PipeComponent.TypeId;      // used to identify shapes type, binded with the library svgeditor
    static LabelTag = 'Pipe';
    static prefixB = 'PIE_';

    static actionsType = {
        stop: 'shapes.action-stop',
        clockwise: 'shapes.action-clockwise',
        anticlockwise: 'shapes.action-anticlockwise',
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
        return GaugeDialogType.Pipe;
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
                // check actions
                if (ga.property.actions) {
                    ga.property.actions.forEach(act => {
                        if (act.variableId === sig.id) {
                            PipeComponent.processAction(act, svgele, value, gaugeStatus);
                        }
                    });
                }
            }
        }
    }

    static processAction(act: GaugeAction, svgele: any, value: any, gaugeStatus: GaugeStatus) {
        var element = SVG.adopt(svgele.node);
        if (act.range.min <= value && act.range.max >= value) {
            PipeComponent.runAction(element, act.type, gaugeStatus);
        }
    }

    static runAction(element, type, gaugeStatus: GaugeStatus) {
        if (PipeComponent.actionsType[type] === PipeComponent.actionsType.stop) {
            if (gaugeStatus.actionRef && gaugeStatus.actionRef.timer) {
                clearTimeout(gaugeStatus.actionRef.timer);
                gaugeStatus.actionRef = null;
            }
        } else {
            if (gaugeStatus.actionRef && gaugeStatus.actionRef.type === type) {
                return;
            }
            if (gaugeStatus.actionRef && gaugeStatus.actionRef.timer) {
                clearTimeout(gaugeStatus.actionRef.timer);
                gaugeStatus.actionRef = null;
            }
            var eletoanim = Utils.searchTreeStartWith(element.node, 'c' + this.prefixB);
            if (eletoanim) {
                let len = 1000;
                if (PipeComponent.actionsType[type] === PipeComponent.actionsType.clockwise) {
                    let timeout = setInterval(() => {
                        if (len < 0) len = 1000;
                        eletoanim.style.strokeDashoffset = len;
                        len--;
                    }, 20);
                    gaugeStatus.actionRef = { type: type, timer: timeout };
                } else if (PipeComponent.actionsType[type] === PipeComponent.actionsType.anticlockwise) {
                    let timeout = setInterval(() => {
                        if (len > 1000) len = 0;
                        eletoanim.style.strokeDashoffset = len;
                        len++;
                    }, 20);
                    gaugeStatus.actionRef = { type: type, timer: timeout };
                }
            }
        }
    }

    static detectChange(gab: GaugeSettings, res: any, ref: any) {
        let data = { id: gab.id, property: gab.property.options };
        let result = ref.nativeWindow.svgEditor.runExtension('pipe', 'initPipe', data);
        return result;
    }
}

export class PipeOptions {
    border: string;
    borderWidth: number;
    pipe: string;
    pipeWidth: number;
    content: string;
    contentWidth: number;
    contentSpace: number;
}