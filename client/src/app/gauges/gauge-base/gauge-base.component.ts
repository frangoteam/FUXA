import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { GaugeSettings, GaugeProperty, GaugeEvent, GaugeEventType, GaugeStatus, GaugeActionStatus } from '../../_models/hmi';

// declare var SVG: any;

@Component({
    selector: 'gauge-base',
    templateUrl: './gauge-base.component.html',
    styleUrls: ['./gauge-base.component.css']
})
export class GaugeBaseComponent implements OnInit {

    @Input() data: any;
    @Input() settings: GaugeSettings;
    @Output() edit: EventEmitter<any> = new EventEmitter();

    constructor() { }

    ngOnInit() {
    }

    onEdit() {
        this.edit.emit(this.settings);
    }

    static pathToAbsolute(relativePath) {
        var pattern = /([ml])\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)/ig,
            coords = [];

        relativePath.replace(pattern, function (match, command, x, y) {
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

    static getEvents(pro: GaugeProperty, type: GaugeEventType) {
        let res: GaugeEvent[] = [];
        if (!pro || !pro.events) {
            return null;
        }
        let idxtype = Object.values(GaugeEventType).indexOf(type);
        pro.events.forEach(ev => {
            if (Object.keys(GaugeEventType).indexOf(ev.type) === idxtype) {
                res.push(ev);
            }
        });
        return res;
    }

    static getUnit(pro: GaugeProperty, id: string, value: string ) {
        if (pro) {
            if (pro.ranges && pro.ranges.length > 0 && pro.ranges[0].type === 'unit') {
                if (pro.ranges[0].textId === id) {
                    pro.ranges[0].text = value;
                }
                return pro.ranges[0].text;
            }
        }
        return '';
    }

    static getDigits(pro: GaugeProperty) {
        if (pro) {
            if (pro.ranges && pro.ranges.length > 0 && pro.ranges[0]['fractionDigits']) {
                return pro.ranges[0]['fractionDigits'];
            }
        }
        return 0;
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

    static checkActionBlink(element: any, type: any, gaugeStatus: GaugeStatus, toEnable: boolean, options: any, dom: boolean) {
        if (!gaugeStatus.actionRef) {
            gaugeStatus.actionRef = new GaugeActionStatus(type);
        }
        gaugeStatus.actionRef.type = type;
        if (toEnable && options.interval && !gaugeStatus.actionRef.timer) {
            var blinkStatus = false;
            // save colors to restore on break
            try {
                if (dom) gaugeStatus.actionRef.spool = { bk: element.style.backgroundColor, clr: element.style.color };
                else gaugeStatus.actionRef.spool = { bk: element.node.getAttribute('fill'), clr: element.node.getAttribute('stroke') };
            } catch (err) {
                console.log(err);
            }
            gaugeStatus.actionRef.timer = setInterval(() => {
                blinkStatus = (blinkStatus) ? false : true;
                try {
                    if (blinkStatus) {
                        if (dom) {
                            element.style.backgroundColor = options.fillA;
                            element.style.color = options.strokeA;
                        } else {
                            element.node.setAttribute('fill', options.fillA);
                            element.node.setAttribute('stroke', options.strokeA);
                        }
                    } else {
                        if (dom) {
                            element.style.backgroundColor = options.fillB;
                            element.style.color = options.strokeB;
                        } else {
                            element.node.setAttribute('fill', options.fillB);
                            element.node.setAttribute('stroke', options.strokeB);
                        }
                    }
                } catch (err) {
                    console.log(err);
                }
            }, options.interval);
        } else if (!toEnable) {
            try {
                if (gaugeStatus.actionRef.timer) {
                    clearInterval(gaugeStatus.actionRef.timer);
                    gaugeStatus.actionRef.timer = null;
                }
                // restore gauge
                if (gaugeStatus.actionRef.spool) {
                    if (dom) {
                        element.style.backgroundColor = gaugeStatus.actionRef.spool.bk;
                        element.style.color = gaugeStatus.actionRef.spool.clr;
                    } else {
                        element.node.setAttribute('fill', gaugeStatus.actionRef.spool.bk);
                        element.node.setAttribute('stroke', gaugeStatus.actionRef.spool.clr);
                    }
                }
            } catch (err) { 
                console.log(err);
            }
        }
    }
}
