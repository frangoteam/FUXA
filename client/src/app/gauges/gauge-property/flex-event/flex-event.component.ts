import { Component, OnInit, Input } from '@angular/core';

import { GaugeSettings, GaugeProperty, GaugeEvent, GaugeEventType, GaugeEventActionType, View } from '../../../_models/hmi';

@Component({
    selector: 'flex-event',
    templateUrl: './flex-event.component.html',
    styleUrls: ['./flex-event.component.css']
})
export class FlexEventComponent implements OnInit {

    @Input() property: GaugeProperty;
    @Input() views: View[];
    @Input() inputs: GaugeSettings[];
    @Input() data: any;

    events: GaugeEvent[];
    eventType: any;
    actionType: any;

    constructor() {
    }

    ngOnInit() {
        this.eventType = GaugeEventType;
        this.actionType = GaugeEventActionType;
        if (this.property) {
            this.events = this.property.events;
            // compatibility with <= 1.0.4
            this.events.forEach(element => {
                if (!element.actoptions) {
                    element.actoptions = {};
                }
            });
        }
        if (!this.events || this.events.length <= 0) {
            this.onAddEvent();
        }
    }

    getEvents() {
        let result = [];
        if (this.events) {
            this.events.forEach(element => {
                if (element.type) {
                    result.push(element);
                }
            });
        }
        return result;
    }

    onAddEvent() {
        let ga: GaugeEvent = new GaugeEvent();
        this.addEvent(ga);
    }

    onRemoveEvent(index: number) {
        this.events.splice(index, 1);
    }

    withDestination(action) {
        let a = Object.keys(this.actionType).indexOf(action);
        let b = Object.values(this.actionType).indexOf(GaugeEventActionType.onpage);
        let c = Object.values(this.actionType).indexOf(GaugeEventActionType.onwindow);
        let d = Object.values(this.actionType).indexOf(GaugeEventActionType.ondialog);
        return (a === b || a === c || a === d) ? true : false;
    }

    withSetValue(action) {
        let a = Object.keys(this.actionType).indexOf(action);
        let b = Object.values(this.actionType).indexOf(GaugeEventActionType.onSetValue);
        return (a === b) ? true : false;
    }

    withSetInput(action) {
        let a = Object.keys(this.actionType).indexOf(action);
        let b = Object.values(this.actionType).indexOf(GaugeEventActionType.onSetInput);
        return (a === b) ? true : false;
    }

    withAddress(action) {
        let a = Object.keys(this.actionType).indexOf(action);
        let b = Object.values(this.actionType).indexOf(GaugeEventActionType.oniframe);
        let c = Object.values(this.actionType).indexOf(GaugeEventActionType.oncard);
        return (a === b || a === c) ? true : false;
    }

    withScale(action) {
        let a = Object.keys(this.actionType).indexOf(action);
        let b = Object.values(this.actionType).indexOf(GaugeEventActionType.oniframe);
        return (a === b) ? true : false;
    }

    setVariable(index, event) {
        this.events[index].actoptions['variableSrc'] = event.variableSrc;
        this.events[index].actoptions['variableId'] = event.variableId;
        this.events[index].actoptions['variable'] = event.variable;
    }
    
    private addEvent(ge: GaugeEvent) {
        if (!this.events) {
            this.events = [];
        }
        this.events.push(ge);
    }
}
