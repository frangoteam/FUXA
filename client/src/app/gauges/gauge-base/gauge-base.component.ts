import { Component, Input, Output, EventEmitter } from '@angular/core';
import { GaugeSettings, GaugeProperty, GaugeEvent, GaugeEventType, GaugeStatus, GaugeActionStatus, GaugePropertyColor, GaugeAction } from '../../_models/hmi';

import { Utils } from '../../_helpers/utils';
import { PropertyType } from '../gauge-property/flex-input/flex-input.component';

// declare var SVG: any;

@Component({
    selector: 'gauge-base',
    templateUrl: './gauge-base.component.html',
    styleUrls: ['./gauge-base.component.css']
})
export class GaugeBaseComponent {

    @Input() data: any;
    @Input() settings: GaugeSettings;
    @Output() edit: EventEmitter<any> = new EventEmitter();

    constructor() { }

    onEdit() {
        this.edit.emit(this.settings);
    }

    static pathToAbsolute(relativePath) {
        var pattern = /([ml])\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)/ig,
            coords = [];

        relativePath.replace(pattern, function(match, command, x, y) {
            var prev;

            x = parseFloat(x);
            y = parseFloat(y);

            if (coords.length === 0 || command.toUpperCase() === command) {
                coords.push([x, y]);
            } else {
                prev = coords[coords.length - 1];
                coords.push([x + prev[0], y + prev[1]]);
            }
        });

        return coords;
    }

    static getEvents(pro: GaugeProperty, type: GaugeEventType): GaugeEvent[] {
        let res: GaugeEvent[] = [];
        if (!pro || !pro.events) {
            return null;
        }
        let idxtype = Object.values(GaugeEventType).indexOf(type);
        pro.events.forEach(ev => {
            if (idxtype < 0 || Object.keys(GaugeEventType).indexOf(ev.type) === idxtype) {
                res.push(ev);
            }
        });
        return res;
    }

    static getUnit(pro: GaugeProperty, gaugeStatus: GaugeStatus) {
        if (pro) {
            if (pro.ranges && pro.ranges.length > 0 && pro.ranges[0].type === PropertyType.output) {
                if (pro.ranges[0].textId && !Utils.isNullOrUndefined(gaugeStatus.variablesValue[pro.ranges[0].textId])) {
                    pro.ranges[0].text = gaugeStatus.variablesValue[pro.ranges[0].textId];
                }
                return pro.ranges[0].text;
            }
        }
        return '';
    }

    static getDigits(pro: GaugeProperty, gaugeStatus: GaugeStatus) {
        if (pro) {
            if (pro.ranges && pro.ranges.length > 0) {
                if (pro.ranges[0]['fractionDigitsId'] && !Utils.isNullOrUndefined(gaugeStatus.variablesValue[pro.ranges[0]['fractionDigitsId']])) {
                    pro.ranges[0]['fractionDigits'] = gaugeStatus.variablesValue[pro.ranges[0]['fractionDigitsId']];
                }
                if (pro.ranges[0]['fractionDigits']) {
                    return pro.ranges[0]['fractionDigits'];
                }
            }
        }
        return null;
    }

    static runActionHide(element, type, gaugeStatus: GaugeStatus) {
        let actionRef = <GaugeActionStatus>{ type: type, animr: element.hide() };
        if (gaugeStatus.actionRef) {
            actionRef.spool = gaugeStatus.actionRef.spool;
            actionRef.timer = gaugeStatus.actionRef.timer;
        }
        gaugeStatus.actionRef = actionRef;
    }

    static runActionShow(element, type, gaugeStatus: GaugeStatus) {
        let actionRef = <GaugeActionStatus>{ type: type, animr: element.show() };
        if (gaugeStatus.actionRef) {
            actionRef.spool = gaugeStatus.actionRef.spool;
            actionRef.timer = gaugeStatus.actionRef.timer;
        }
        gaugeStatus.actionRef = actionRef;
    }

    static checkActionBlink(element: any, act: GaugeAction, gaugeStatus: GaugeStatus, toEnable: boolean, dom: boolean, propertyColor?: GaugePropertyColor) {
        if (!gaugeStatus.actionRef) {
            gaugeStatus.actionRef = new GaugeActionStatus(act.type);
        }
        gaugeStatus.actionRef.type = act.type;
        if (toEnable) {
            GaugeBaseComponent.clearAnimationTimer(gaugeStatus.actionRef);
            var blinkStatus = false;
            // save action (dummy) id and colors to restore on break
            try {
                const actId = GaugeBaseComponent.getBlinkActionId(act);
                if (dom) {
                    gaugeStatus.actionRef.spool = { bk: element.style.backgroundColor, clr: element.style.color, actId: actId };
                }
                else {
                    gaugeStatus.actionRef.spool = { bk: element.node.getAttribute('fill'), clr: element.node.getAttribute('stroke'), actId: actId };
                }
            } catch (err) {
                console.error(err);
            }
            gaugeStatus.actionRef.timer = setInterval(() => {
                blinkStatus = (blinkStatus) ? false : true;
                try {
                    if (blinkStatus) {
                        if (dom) {
                            element.style.backgroundColor = act.options.fillA;
                            element.style.color = act.options.strokeA;
                        } else {
                            element.node.setAttribute('fill', act.options.fillA);
                            element.node.setAttribute('stroke', act.options.strokeA);
                        }
                    } else {
                        if (dom) {
                            element.style.backgroundColor = act.options.fillB;
                            element.style.color = act.options.strokeB;
                        } else {
                            element.node.setAttribute('fill', act.options.fillB);
                            element.node.setAttribute('stroke', act.options.strokeB);
                        }
                    }
                } catch (err) {
                    console.error(err);
                }
            }, act.options.interval);
        } else if (!toEnable) {
            try {
                // restore gauge
                if (!gaugeStatus.actionRef.spool || gaugeStatus.actionRef.spool.actId === GaugeBaseComponent.getBlinkActionId(act)) {
                    if (gaugeStatus.actionRef.timer) {
                        clearInterval(gaugeStatus.actionRef.timer);
                        gaugeStatus.actionRef.timer = null;
                    }
                    // check to overwrite with property color
                    if (propertyColor && gaugeStatus.actionRef.spool) {
                        if (propertyColor.fill) {
                            gaugeStatus.actionRef.spool.bk = propertyColor.fill;
                        }
                        if (propertyColor.stroke) {
                            gaugeStatus.actionRef.spool.clr = propertyColor.stroke;
                        }
                    }
                    if (dom) {
                        element.style.backgroundColor = gaugeStatus.actionRef.spool?.bk;
                        element.style.color = gaugeStatus.actionRef.spool?.clr;
                    } else if (gaugeStatus.actionRef.spool) {
                        element.node.setAttribute('fill', gaugeStatus.actionRef.spool.bk);
                        element.node.setAttribute('stroke', gaugeStatus.actionRef.spool.clr);
                    }
                }
            } catch (err) {
                console.error(err);
            }
        }
    }

    static clearAnimationTimer(actref: GaugeActionStatus) {
        if (actref && actref.timer) {
            clearTimeout(actref.timer);
            actref.timer = null;
        }
    }

    static checkBitmask(bitmask: number, value: number): number {
        if (bitmask) {
            return (value & bitmask) ? 1 : 0;
        }
        return value;
    }

    static checkBitmaskAndValue(bitmask: number, value: number, min: number, max: number): number {
        if (bitmask) {
            return (value & max & bitmask) ? 1 : 0;
        }
        return (value == min) ? 0 : 1;
    }

    static valueBitmask(bitmask: number, value: number, source: number): number {
        if (bitmask) {
            return (value & bitmask) | (source & ~bitmask);
        }
        return value;
    }

    static getBlinkActionId(act: GaugeAction) {
        return `${act.variableId}-${act.range.max}-${act.range.min}`;
    }
}
