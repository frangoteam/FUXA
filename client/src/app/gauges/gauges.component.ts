import { Component, OnInit, OnDestroy, Injectable, Inject, Output, EventEmitter } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { Observable } from 'rxjs/Rx';

import { HmiService } from '../_services/hmi.service';

import { GaugeBaseComponent } from './gauge-base/gauge-base.component';
import { SwitchComponent } from './switch/switch.component';
import { GaugeSettings, GaugeProperty, Variable, Event, GaugeEvent, GaugeEventType } from '../_models/hmi';
import { ValueComponent } from './controls/value/value.component';
import { CompressorComponent } from './proc-eng/compressor/compressor.component';
import { ValveComponent } from './proc-eng/valve/valve.component';
import { MotorComponent } from './proc-eng/motor/motor.component';
import { ExchangerComponent } from './proc-eng/exchanger/exchanger.component';
import { GaugePropertyComponent, GaugeDialogType } from './gauge-property/gauge-property.component';
import { HtmlInputComponent } from './controls/html-input/html-input.component';
import { HtmlButtonComponent } from './controls/html-button/html-button.component';
import { HtmlSelectComponent } from './controls/html-select/html-select.component';
import { HtmlChartComponent } from './controls/html-chart/html-chart.component';
import { GaugeProgressComponent } from './controls/gauge-progress/gauge-progress.component';
import { GaugeSemaphoreComponent } from './controls/gauge-semaphore/gauge-semaphore.component';

import { Dictionary } from '../_helpers/dictionary';
import { NgxDygraphsComponent } from '../gui-helpers/ngx-dygraphs/ngx-dygraphs.component';


@Injectable()
export class GaugesManager {

  @Output() onchange: EventEmitter<Variable> = new EventEmitter();
  @Output() onevent: EventEmitter<Event> = new EventEmitter();

  // signalGaugeMap = new ViewSignalGaugeMap();      // map of all gauges (GaugeSettings) pro signals

  eventGauge: MapGaugesSetting = {};
  mapGaugeView = {};
  memorySigGauges = {};

  gaugeWithProperty = [CompressorComponent.TypeTag, ValveComponent.TypeTag, MotorComponent.TypeTag, ExchangerComponent.TypeTag, ValueComponent.TypeTag,
                      HtmlInputComponent.TypeTag, HtmlButtonComponent.TypeTag, HtmlSelectComponent.TypeTag, GaugeProgressComponent.TypeTag, 
                      GaugeSemaphoreComponent.TypeTag];
  gaugeWithEvents = [CompressorComponent.TypeTag, ValveComponent.TypeTag, MotorComponent.TypeTag, ExchangerComponent.TypeTag, HtmlButtonComponent.TypeTag];

  constructor(private hmiService: HmiService,
    private dialog: MatDialog) {
    this.hmiService.onVariableChanged.subscribe(sig => {
      try {
        this.onchange.emit(sig);
      } catch (err) {
        
      }
    });
  }

  ngOnDestroy() {
    console.log('GaugesManager destroy');
  }

  private randomRange(min, max) {
    return (Math.random() * (max - min + 1)) + min;
  }

  createSettings(id: string, type: string) {
    let gs: GaugeSettings = null;
    switch (type) {
      case CompressorComponent.TypeTag:
        gs = new GaugeSettings(id, type);
        gs.label = CompressorComponent.LabelTag;
        break;
      case ValveComponent.TypeTag:
        gs = new GaugeSettings(id, type);
        gs.label = ValveComponent.LabelTag;
        break;
      case MotorComponent.TypeTag:
        gs = new GaugeSettings(id, type);
        gs.label = MotorComponent.LabelTag;
        break;
      case ExchangerComponent.TypeTag:
        gs = new GaugeSettings(id, type);
        gs.label = ExchangerComponent.LabelTag;
        break;
      case ValueComponent.TypeTag:
        gs = new GaugeSettings(id, type);
        gs.label = ValueComponent.LabelTag;
        break;
      case SwitchComponent.TypeTag:
        gs = new GaugeSettings(id, type);
        gs.label = SwitchComponent.LabelTag;
        break;
      case HtmlInputComponent.TypeTag:
        gs = new GaugeSettings(id, type);
        gs.label = HtmlInputComponent.LabelTag;
        break;
      case HtmlButtonComponent.TypeTag:
        gs = new GaugeSettings(id, type);
        gs.label = HtmlButtonComponent.LabelTag;
        break;
      case HtmlSelectComponent.TypeTag:
        gs = new GaugeSettings(id, type);
        gs.label = HtmlSelectComponent.LabelTag;
        break;
      case HtmlChartComponent.TypeTag:
        gs = new GaugeSettings(id, type);
        gs.label = HtmlChartComponent.LabelTag;
        break;
      case GaugeProgressComponent.TypeTag:
        gs = new GaugeSettings(id, type);
        gs.label = GaugeProgressComponent.LabelTag;
        break;
      case GaugeSemaphoreComponent.TypeTag:
        gs = new GaugeSettings(id, type);
        gs.label = GaugeSemaphoreComponent.LabelTag;
        break;
    }
    return gs;
  }

  isWithEvents(type) {
    if (type) {
      return this.gaugeWithEvents.indexOf(type) > -1;
    }
    return false;
  }

  isGauge(type: string) {
    return this.gaugeWithProperty.indexOf(type) > -1;
  }

  public isToInitInEditor(ga: GaugeSettings) {
    if (ga.type === GaugeProgressComponent.TypeTag) {
      GaugeProgressComponent.initElement(ga);
    } else if (ga.type === HtmlButtonComponent.TypeTag) {
      HtmlButtonComponent.initElement(ga);
    } else if (ga.type === HtmlChartComponent.TypeTag) {
      HtmlChartComponent.detectChange(ga);
    }
    return false;
  }

  setSignalValue(sig: Variable) {
    console.log('end set ' + sig.id + ' ' + sig.value);
    this.onchange.emit(sig);
  }

  public initGaugesMap() {
    this.eventGauge = {};
    this.mapGaugeView = {};
  }

  public emitBindedSignals(domViewId: string) {
    this.hmiService.emitMappedSignalsGauge(domViewId);
  }
  /**
   * bind dom view, gauge with signal (for animation) and event
   * @param gaugekey
   * @param gauge
   * @param domViewId 
   * @param ga 
   * @param bindclick 
   * @param bindhtmlevent 
   */
  public bindGauge(gauge: any, domViewId: string, ga: GaugeSettings, bindclick: any, bindhtmlevent: any) {
    let sigsid: string[] = this.getBindSignals(ga);
    if (sigsid) {
      for (let i = 0; i < sigsid.length; i++) {
        this.hmiService.addSignalGaugeToMap(domViewId, sigsid[i], ga);
        // check for special gauge to save in memory binded to sigid (chart-html)
        if (gauge) {
          if (!this.memorySigGauges[sigsid[i]]) {
            this.memorySigGauges[sigsid[i]] = {};
            this.memorySigGauges[sigsid[i]][ga.id] = gauge;
          } else if (!this.memorySigGauges[sigsid[i]][ga.id]) {
            this.memorySigGauges[sigsid[i]][ga.id] = gauge;
          }
        }        
      }
    }
    let clicks: GaugeEvent[] = this.getBindClick(ga);
    if (clicks) { // && !this.eventGauge[ga.id]) {
      this.eventGauge[ga.id] = ga;
      if (!this.mapGaugeView[ga.id]) {
        this.mapGaugeView[ga.id] = {};
        this.mapGaugeView[ga.id][domViewId] = ga;
        bindclick(ga);
      } else if (!this.mapGaugeView[ga.id][domViewId]) {
        this.mapGaugeView[ga.id][domViewId] = ga;
        bindclick(ga);
      }
      // bindclick(ga);
    }
    let htmlEvents = this.getHtmlEvents(ga);
    if (htmlEvents) {
      this.eventGauge[htmlEvents.dom.id] = ga;
      bindhtmlevent(htmlEvents);
    }
    this.checkElementToInit(ga);
  }


  /**
   * remove bind of dom view gauge
   * @param domViewId 
   */
  public unbindGauge(domViewId: string) {
    // first remove special gauge like chart from memorySigGauges
    let sigGaugeSettingsIdremoved = this.hmiService.removeSignalGaugeFromMap(domViewId);
    Object.keys(sigGaugeSettingsIdremoved).forEach(sid => {
      delete this.memorySigGauges[sid][sigGaugeSettingsIdremoved[sid]];
    });
    // remove mapped gauge for events of this view
    Object.values(this.mapGaugeView).forEach(val => {
      if (val[domViewId]) {
        delete val[domViewId];
      }
    });
  }

  checkElementToInit(ga: GaugeSettings) {
    if (ga.type === HtmlSelectComponent.TypeTag) {
      return HtmlSelectComponent.initElement(ga);
    }
    // } else if (ga.type === GaugeProgressComponent.TypeTag) {
    //   return GaugeProgressComponent.initElement(ga);
    // }
    return null;
  }

  public onGaugeClick(evt: any) {

  }

  /**
   * get all gauge settings binded to dom view with the signal
   * @param domViewId 
   * @param sigid 
   */
  public getGaugeSettings(domViewId: string, sigid: string) : GaugeSettings[] {
    let gslist = this.hmiService.getMappedSignalsGauges(domViewId, sigid);
    return gslist;
  }

  /**
   * get all signals mapped in all dom views
   * @param fulltext a copy with item name and source 
   */
  public getMappedGaugesSignals(fulltext: boolean) {
    return this.hmiService.getMappedVariables(fulltext);
  }

  public getBindSignals(ga: GaugeSettings) {    // to remove
    if (ga.property) {
      if (ga.type === SwitchComponent.TypeTag) {
        return SwitchComponent.getSignals(ga.property);
      } else if (ga.type === ValveComponent.TypeTag) {
        return ValveComponent.getSignals(ga.property);
      } else if (ga.type === MotorComponent.TypeTag) {
        return MotorComponent.getSignals(ga.property);
      } else if (ga.type === ExchangerComponent.TypeTag) {
        return ExchangerComponent.getSignals(ga.property);
      } else if (ga.type === ValueComponent.TypeTag) {
        return ValueComponent.getSignals(ga.property);
      } else if (ga.type === CompressorComponent.TypeTag) {
        return CompressorComponent.getSignals(ga.property);
      } else if (ga.type === HtmlInputComponent.TypeTag) {
        return HtmlInputComponent.getSignal(ga.property);
      } else if (ga.type === HtmlButtonComponent.TypeTag) {
        return HtmlButtonComponent.getSignal(ga.property);
      } else if (ga.type === HtmlSelectComponent.TypeTag) {
        return HtmlSelectComponent.getSignal(ga.property);
      } else if (ga.type === GaugeProgressComponent.TypeTag) {
        return GaugeProgressComponent.getSignal(ga.property);
      } else if (ga.type === GaugeSemaphoreComponent.TypeTag) {
        return GaugeSemaphoreComponent.getSignal(ga.property);
      } else if (ga.type === HtmlChartComponent.TypeTag) {      
        let sigs = this.hmiService.getChartSignal(ga.property.id)
        return sigs; 
      }
    }
    return null;
  }

  public getBindClick(ga: GaugeSettings) {
    if (ga.type === CompressorComponent.TypeTag) {
      return CompressorComponent.getEvents(ga.property, GaugeEventType.click);
    } else if (ga.type === ValveComponent.TypeTag) {
      return ValveComponent.getEvents(ga.property, GaugeEventType.click);
    } else if (ga.type === MotorComponent.TypeTag) {
      return MotorComponent.getEvents(ga.property, GaugeEventType.click);
    } else if (ga.type === ExchangerComponent.TypeTag) {
      return ExchangerComponent.getEvents(ga.property, GaugeEventType.click);
    } else if (ga.type === HtmlButtonComponent.TypeTag) {
      return HtmlButtonComponent.getEvents(ga.property, GaugeEventType.click);
    }
    return null;
  }

  public getHtmlEvents(ga: GaugeSettings): Event {
    if (ga.type === HtmlInputComponent.TypeTag) {
      return HtmlInputComponent.getHtmlEvents(ga);
    } else if (ga.type === HtmlSelectComponent.TypeTag) {
      return HtmlSelectComponent.getHtmlEvents(ga);
    }
    return null;
  }

  /**
   * manage to which gauge to forward the process function
   * @param ga 
   * @param svgele 
   * @param sig 
   */
  public processValue(ga: GaugeSettings, svgele: any, sig: Variable) {
    // console.log('gaid: ' + ga.id);
    if (ga.type === SwitchComponent.TypeTag) {
      return SwitchComponent.processValue(ga, svgele, sig);
    } else if (ga.type === ValveComponent.TypeTag) {
      return ValveComponent.processValue(ga, svgele, sig);
    } else if (ga.type === MotorComponent.TypeTag) {
      return MotorComponent.processValue(ga, svgele, sig);
    } else if (ga.type === ValueComponent.TypeTag) {
      return ValueComponent.processValue(ga, svgele, sig);
    } else if (ga.type === CompressorComponent.TypeTag) {
      return CompressorComponent.processValue(ga, svgele, sig);
    } else if (ga.type === ExchangerComponent.TypeTag) {
      return ExchangerComponent.processValue(ga, svgele, sig);
    } else if (ga.type === HtmlInputComponent.TypeTag) {
      return HtmlInputComponent.processValue(ga, svgele, sig);
    } else if (ga.type === HtmlButtonComponent.TypeTag) {
      return HtmlButtonComponent.processValue(ga, svgele, sig);
    } else if (ga.type === HtmlSelectComponent.TypeTag) {
      return HtmlSelectComponent.processValue(ga, svgele, sig);
    } else if (ga.type === GaugeProgressComponent.TypeTag) {
      return GaugeProgressComponent.processValue(ga, svgele, sig);
    } else if (ga.type === GaugeSemaphoreComponent.TypeTag) {
      return GaugeSemaphoreComponent.processValue(ga, svgele, sig);
    } else if (ga.type === HtmlChartComponent.TypeTag) {
      if (ga.property.type !== '_history' && this.memorySigGauges[sig.id]) {
        Object.keys(this.memorySigGauges[sig.id]).forEach(k => {
          HtmlChartComponent.processValue(ga, svgele, sig, this.memorySigGauges[sig.id][k]);
        });
      }
    }
  }

  public putEvent(event: Event) {
    if (event.ga.property && event.ga.property.variableId) {
      this.hmiService.putSignalValue(event.ga.property.variableId, event.value);
      event.dbg = 'put ' + event.ga.property.variableId + ' ' + event.value;
    }
    this.onevent.emit(event);
  }

  public putSignalValue(sigid: string, val: string) {
    this.hmiService.putSignalValue(sigid, val);
  }

  public static getEditDialogTypeToUse(type: string): GaugeDialogType {
    if (type === SwitchComponent.TypeTag) {
      return GaugeDialogType.OnlyValue;
    } else if (type === ValveComponent.TypeTag) {
      return GaugeDialogType.RangeWithAlarm;
    } else if (type === MotorComponent.TypeTag) {
      return GaugeDialogType.RangeWithAlarm;
    } else if (type === ValueComponent.TypeTag) {
      return GaugeDialogType.ValueAndUnit;
    } else if (type === CompressorComponent.TypeTag) {
      return GaugeDialogType.RangeWithAlarm;
    } else if (type === ExchangerComponent.TypeTag) {
      return GaugeDialogType.RangeWithAlarm;
    } else if (type === HtmlInputComponent.TypeTag) {
      return GaugeDialogType.OnlyValue;
    } else if (type === HtmlButtonComponent.TypeTag) {
      return GaugeDialogType.OnlyValue;
    } else if (type === HtmlSelectComponent.TypeTag) {
      return GaugeDialogType.Step;
    } else if (type === GaugeProgressComponent.TypeTag) {
      return GaugeDialogType.MinMax;
    } else if (type === GaugeSemaphoreComponent.TypeTag) {
      return GaugeDialogType.Range;
    } else if (type === HtmlChartComponent.TypeTag) {
      return GaugeDialogType.Chart;
    }
  }

  public static getDefaultValue(type: string): any {
    if (type === GaugeProgressComponent.TypeTag) {
      return GaugeProgressComponent.getDefaultValue();
    }
    return null;
  }

  public static checkGaugeColor(ele: any, eles: any, colors: any): boolean {
    if (ele && eles && (eles.length <= 1 || !eles[1])) {
      if (ele.type === GaugeProgressComponent.TypeTag) {
        colors.fill = GaugeProgressComponent.getFillColor(eles[0]);
        colors.stroke = GaugeProgressComponent.getStrokeColor(eles[0]);
        return true;
      } else if (ele.type === GaugeSemaphoreComponent.TypeTag) {
        colors.fill = GaugeSemaphoreComponent.getFillColor(eles[0]);
        colors.stroke = GaugeSemaphoreComponent.getStrokeColor(eles[0]);
        return true;
      } else if (ele.type === HtmlButtonComponent.TypeTag) {
        colors.fill = HtmlButtonComponent.getFillColor(eles[0]);
        colors.stroke = HtmlButtonComponent.getStrokeColor(eles[0]);
        return true;
      } else if (ele.type === HtmlInputComponent.TypeTag) {
        colors.fill = HtmlInputComponent.getFillColor(eles[0]);
        colors.stroke = HtmlInputComponent.getStrokeColor(eles[0]);
        return true;
      } else if (ele.type === HtmlSelectComponent.TypeTag) {
        colors.fill = HtmlSelectComponent.getFillColor(eles[0]);
        colors.stroke = HtmlSelectComponent.getStrokeColor(eles[0]);
        return true;
      }
    }
    return false;
  }

  public static initElementColor(bkcolor, color, elems) {
    for (let i = 0; i < elems.length; i++) {
      let type = elems[i].getAttribute('type');
      if (type === GaugeProgressComponent.TypeTag) {
        GaugeProgressComponent.initElementColor(bkcolor, color, elems[i]);
      } else if (type === HtmlButtonComponent.TypeTag) {
        HtmlButtonComponent.initElementColor(bkcolor, color, elems[i]);
      } else if (type === HtmlInputComponent.TypeTag) {
        HtmlInputComponent.initElementColor(bkcolor, color, elems[i]);
      } else if (type === HtmlSelectComponent.TypeTag) {
        HtmlSelectComponent.initElementColor(bkcolor, color, elems[i]);
      }
    }
  }

  public initElementAdded(ga: GaugeSettings, res: any, ref: any, isview: boolean) {
    // add variable
    let sigsid: string[] = this.getBindSignals(ga);
    if (sigsid) {
      for (let i = 0; i < sigsid.length; i++) {
        this.hmiService.addSignal(sigsid[i], ga);
      }
    }
    if (ga.type === HtmlChartComponent.TypeTag) {
      let gauge: NgxDygraphsComponent = HtmlChartComponent.initElement(ga, res, ref, isview);
      gauge.init();
      if (ga.property) {
        let chart = this.hmiService.getChart(ga.property.id)
        chart.lines.forEach(line => {
            let sigid = HmiService.toVariableId(line.device, line.id);
            let sigProperty = this.hmiService.getMappedVariable(sigid, true);
            if (sigProperty) {
            gauge.addLine(sigid, sigProperty.name, line.color);
            }
        });
        // gauge.setOptions({title: chart.name});
      }
      gauge.resize();
      // gauge.onTimeRange = this.onTimeRange;
      return gauge;
    }
  }

  /**
   * clear memory object used from view, some reset
   */
  public clearMemory() {
    this.memorySigGauges = {};
  }
}

interface MapGaugesSetting {
  [x: string]: GaugeSettings
}