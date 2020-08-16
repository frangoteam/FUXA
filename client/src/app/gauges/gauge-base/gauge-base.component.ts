import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { GaugeSettings, GaugeProperty, GaugeEvent, GaugeEventType } from '../../_models/hmi';

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

    static getUnit(pro: GaugeProperty) {
        if (pro) {
            if (pro.ranges && pro.ranges.length > 0 && pro.ranges[0].type === 'unit') {
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
}
