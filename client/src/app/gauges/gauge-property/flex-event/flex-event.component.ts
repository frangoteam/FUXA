import { Component, OnInit, Input } from '@angular/core';

import { GaugeProperty, GaugeEvent, GaugeEventType, GaugeEventActionType, View } from '../../../_models/hmi';

@Component({
  selector: 'flex-event',
  templateUrl: './flex-event.component.html',
  styleUrls: ['./flex-event.component.css']
})
export class FlexEventComponent implements OnInit {

  @Input() property: GaugeProperty;
  @Input() views: View[];
  
  events: GaugeEvent[];
  eventType: any;
  actionType: any;

  constructor() { }

  ngOnInit() {
    this.eventType = GaugeEventType;
    this.actionType = GaugeEventActionType;    
    if (this.property) {
      this.events = this.property.events;
    }
  }

  getEvents() {
    let result = [];
    this.events.forEach(element => {
      if (element.type) {
        result.push(element);
      }
    });
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
    let b = Object.values(this.actionType).indexOf(GaugeEventActionType.onSetValue);
    return (a >= 0 && a != b) ? true : false;
  }

  withSetValue(action) {
    let a = Object.keys(this.actionType).indexOf(action);
    let b = Object.values(this.actionType).indexOf(GaugeEventActionType.onSetValue);
    return (a === b) ? true : false;
  }

  private addEvent(ge: GaugeEvent) {
    if (!this.events) {
      this.events = [];
    }
    this.events.push(ge);    
  }
}
