import {
  AfterViewInit,
  Component,
  ComponentFactoryResolver,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import {Subscription} from "rxjs";

import {Event, GaugeEvent, GaugeEventActionType, GaugeSettings, GaugeStatus, Hmi, View} from '../_models/hmi';
import {GaugesManager} from '../gauges/gauges.component';
import {isUndefined} from 'util';
import {Utils} from '../_helpers/utils';
import {HmiService} from "../_services/hmi.service";
import {USER_DEFINED_VARIABLE} from "../gauges/gauge-property/flex-variable/flex-variable.component";

declare var SVG: any;

@Component({
  selector: 'app-fuxa-view',
  templateUrl: './fuxa-view.component.html',
  styleUrls: ['./fuxa-view.component.css']
})
export class FuxaViewComponent implements OnInit, AfterViewInit {
  @Input() id: string;
  @Input() variablesMapping: any = [];
  @Input() view: View;
  @Input() hmi: Hmi;
  @Input() child: boolean = false;
  @Input() gaugesManager: GaugesManager;        // gauges.component
  @Input() parentcards: CardModel[];
  @Output() onclose = new EventEmitter();

  @ViewChild('dataContainer') dataContainer: ElementRef;

  cards: CardModel[] = [];
  iframes: CardModel[] = [];
  dialog: DialogModalModel;
  mapGaugeStatus = {};

  private subscriptionOnChange: Subscription;
  protected staticValues: any = {};
  protected plainVariableMapping: any = {};

  constructor(private el: ElementRef,
              private viewContainerRef: ViewContainerRef,
              private resolver: ComponentFactoryResolver) {
  }

  ngOnInit() {
    try {
      if (this.variablesMapping) {
        this.variablesMapping.forEach(variableMapping => {
          this.plainVariableMapping[variableMapping.from.variableId] = variableMapping.to.variableId
        })
      }
    } catch (err) {
      console.log(err);
    }
  }

  ngAfterViewInit() {
    this.loadHmi(this.view);
    try {
      this.gaugesManager.emitBindedSignals(this.id);
    } catch (e) {
    }
  }

  ngOnDestroy() {
    this.gaugesManager.unbindGauge(this.id);
    this.clearGaugeStatus();
    try {
      if (this.subscriptionOnChange) {
        this.subscriptionOnChange.unsubscribe();
      }
    } catch (e) {
    }
  }

  private clearGaugeStatus() {
    Object.values(this.mapGaugeStatus).forEach((gs: GaugeStatus) => {
      try {
        if (gs.actionRef && gs.actionRef.timer) {
          clearTimeout(gs.actionRef.timer);
        }
      } catch (e) {
      }
    });
    this.mapGaugeStatus = {};
  }

  /**
   * load the svg content to show in browser, clear all binded to this view
   * @param view
   */
  public loadHmi(view: View) {
    if (this.id) {
      this.gaugesManager.unbindGauge(this.id);
      this.clearGaugeStatus();
    }
    if (view) {
      this.id = view.id;
      this.view = view;
      this.dataContainer.nativeElement.innerHTML = view.svgcontent.replace('<title>Layer 1</title>', '');
      if (view.profile.bkcolor && this.child) {
        this.dataContainer.nativeElement.style.backgroundColor = view.profile.bkcolor;
      }
    }
    this.loadWatch(this.view);
  }

  /**
   * load all gauge settings, bind gauge with signals, bind gauge event
   * @param view
   */
  private loadWatch(view: View) {
    if (view && view.items) {
      let items = this.applyVariableMapping(view.items);
      // this.gaugesManager.initGaugesMap();
      for (let key in items) {
        if (!items.hasOwnProperty(key)) {
          continue;
        }
        let gauge = this.gaugesManager.initElementAdded(items[key], this.resolver, this.viewContainerRef, true);
        this.gaugesManager.bindGauge(gauge, this.id, items[key],
          (gatobindclick) => {
            this.onBindClick(gatobindclick);
          },
          (gatobindhtmlevent) => {
            this.onBindHtmlEvent(gatobindhtmlevent);
          });
      }
      this.subscriptionOnChange = this.gaugesManager.onchange.subscribe(this.handleSignal.bind(this));
      for (let variableId in this.staticValues) {
        if (!this.staticValues.hasOwnProperty(variableId)) {
          continue;
        }
        this.handleSignal({
          id: variableId,
          value: this.staticValues[variableId]
        });
      }
    }
  }

  protected handleSignal(sig) {
    if (!isUndefined(sig.value)) {
      try {
        // take all gauges settings binded to the signal id in this view
        let gas = this.gaugesManager.getGaugeSettings(this.id, sig.id);
        if (gas) {
          for (let i = 0; i < gas.length; i++) {
            let gaugeSetting = gas[i];
            let gaugeStatus = this.getGaugeStatus(gaugeSetting);
            if (this.checkStatusValue(gaugeSetting.id, gaugeStatus, sig)) {
              let svgeles = FuxaViewComponent.getSvgElements(gaugeSetting.id);
              for (let y = 0; y < svgeles.length; y++) {
                this.gaugesManager.processValue(gaugeSetting, svgeles[y], sig, gaugeStatus);
              }
            }
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
  }

  /**
   * return the mapped gauge status, if it doesn't exist add it
   * @param ga
   */
  private getGaugeStatus(ga: GaugeSettings): GaugeStatus {
    if (this.mapGaugeStatus[ga.id]) {
      return this.mapGaugeStatus[ga.id];
    } else {
      this.mapGaugeStatus[ga.id] = this.gaugesManager.createGaugeStatus(ga);
      return this.mapGaugeStatus[ga.id];
    }
  }

  /**
   * Replace variables by defined mapping
   * @param items
   * @protected
   */
  protected applyVariableMapping(items) {
    // Deep clone
    items = JSON.parse(JSON.stringify(items));

    for (let gaId in items) {
      if (!items.hasOwnProperty(gaId)) {
        continue;
      }
      let property = items[gaId].property;
      if (!property) {
        continue;
      }
      this.applyVariableMappingTo(property);
      if (property.actions) {
        property.actions.forEach(action => {
          this.applyVariableMappingTo(action);
        });
      }

      if (property.events) {
        property.events.forEach((event: GaugeEvent) => {
          if (Utils.isObject(event.actoptions['variable'])) {
            this.applyVariableMappingTo(event.actoptions['variable']);
          } else {
            this.applyVariableMappingTo(event.actoptions);
          }
        })
      }
    }
    return items;
  }

  protected applyVariableMappingTo(target) {
    if (!target || !target['variableId']) {
      return;
    }
    if (this.plainVariableMapping.hasOwnProperty(target.variableId)) {
      if (HmiService.variableSrc(this.plainVariableMapping[target.variableId]) === USER_DEFINED_VARIABLE) {
        // Generate uniq user defined variable name and set static value
        let value = HmiService.variable(this.plainVariableMapping[target.variableId]);
        target.variableId = HmiService.toVariableId(USER_DEFINED_VARIABLE, Utils.getShortGUID());
        this.staticValues[target.variableId] = value;
      } else {
        target.variableId = this.plainVariableMapping[target.variableId];
      }
    }
  }

  /**
   * check the change of variable value in gauge status
   * @param gaugeId
   * @param gaugeStatus
   * @param signal
   */
  private checkStatusValue(gaugeId: string, gaugeStatus: GaugeStatus, signal: any) {
    let result = true;
    if (gaugeStatus.onlyChange) {
      if (gaugeStatus.takeValue) {
        let value = this.gaugesManager.getGaugeValue(gaugeId);
        gaugeStatus.variablesValue[signal.id] = value;
      }
      if (gaugeStatus.variablesValue[signal.id] === signal.value) {
        result = false;
      }
    }
    gaugeStatus.variablesValue[signal.id] = signal.value;
    return result;
  }

  /**
   * bind the gauge svg element with click event
   * @param ga
   */
  private onBindClick(ga: GaugeSettings) {
    let self = this;
    let svgele = FuxaViewComponent.getSvgElement(ga.id);
    if (svgele) {
      svgele.click(function (ev) {
        let event = self.gaugesManager.getBindClick(ga);
        if (event && event.length > 0) {
          for (let i = 0; i < event.length; i++) {
            let actindex = Object.keys(GaugeEventActionType).indexOf(event[i].action);
            let eventTypes = Object.values(GaugeEventActionType);
            if (eventTypes.indexOf(GaugeEventActionType.onpage) === actindex) {
              self.loadPage(ev, event[i].actparam);
            } else if (eventTypes.indexOf(GaugeEventActionType.onwindow) === actindex) {
              self.onOpenCard(ga.id, ev, event[i].actparam, event[i].actoptions);
            } else if (eventTypes.indexOf(GaugeEventActionType.ondialog) === actindex) {
              self.openDialog(ev, event[i].actparam, event[i].actoptions);
            } else if (eventTypes.indexOf(GaugeEventActionType.onSetValue) === actindex) {
              self.onSetValue(ga, event[i]);
            } else if (eventTypes.indexOf(GaugeEventActionType.onSetInput) === actindex) {
              self.onSetInput(ga, event[i]);
            } else if (eventTypes.indexOf(GaugeEventActionType.oniframe) === actindex) {
              self.openIframe(ga.id, ev, event[i].actparam, event[i].actoptions);
            } else if (eventTypes.indexOf(GaugeEventActionType.oncard) === actindex) {
              self.openWindow(ga.id, ev, event[i].actparam, event[i].actoptions);
            } else if (eventTypes.indexOf(GaugeEventActionType.onclose) === actindex) {
              self.onClose(ev);
            }
          }
        }
      });
    }
  }

  /**
   * bind the html input control with key-enter event and select control with change event
   * @param htmlevent
   */
  private onBindHtmlEvent(htmlevent: Event) {
    let self = this;
    // let htmlevent = this.getHtmlElement(ga.id);
    if (htmlevent.type === 'key-enter') {
      htmlevent.dom.onkeypress = function (ev) {
        if (ev.keyCode === 13) {
          console.log('enter sig ' + htmlevent.dom.id + ' ' + htmlevent.dom.value);
          htmlevent.dbg = 'key pressed ' + htmlevent.dom.id + ' ' + htmlevent.dom.value;
          htmlevent.id = htmlevent.dom.id;
          htmlevent.value = htmlevent.dom.value;
          self.gaugesManager.putEvent(htmlevent);
        }
      };
    } else if (htmlevent.type === 'change') {
      htmlevent.dom.onchange = function (ev) {
        console.log('change sig ' + htmlevent.dom.id + ' ' + htmlevent.dom.value);
        htmlevent.dbg = 'key pressed ' + htmlevent.dom.id + ' ' + htmlevent.dom.value;
        htmlevent.id = htmlevent.dom.id;
        htmlevent.value = htmlevent.dom.value;
        self.gaugesManager.putEvent(htmlevent);
      };
    }
  }

  private getView(viewref: string): View {
    let view: View;
    for (let i = 0; this.hmi.views.length; i++) {
      if (this.hmi.views[i] && this.hmi.views[i].id === viewref) {
        view = this.hmi.views[i];
        break;
      }
    }
    return view;
  }

  private static getSvgElements(svgid: string) {
    let ele = document.getElementsByTagName('svg');
    let result = [];
    for (let i = 0; i < ele.length; i++) {
      let svgItems = ele[i].getElementById(svgid);
      if (svgItems) {
        result.push(SVG.adopt(svgItems));
      }
    }
    return result;
  }

  private static getSvgElement(svgid: string) {
    let ele = document.getElementsByTagName('svg');
    for (let i = 0; i < ele.length; i++) {
      let svgItems = ele[i].getElementById(svgid);
      if (svgItems) {
        return SVG.adopt(svgItems);
      }
    }
  }

  private loadPage(event, viewref: string) {
    let view: View = this.getView(viewref);
    if (view) {
      this.loadHmi(view);
    }
  }

  openDialog(event, viewref: string, options: any = {}) {
    let view: View = this.getView(viewref);
    if (!view) {
      return;
    }
    this.dialog = new DialogModalModel(viewref);
    this.dialog.width = view.profile.width;
    this.dialog.height = view.profile.height + 26;
    this.dialog.view = view;
    this.dialog.bkcolor = 'trasparent';
    this.dialog.variablesMapping = options.variablesMapping;
    if (view.profile.bkcolor) {
      this.dialog.bkcolor = view.profile.bkcolor;
    }
  }

  onOpenCard(id: string, event, viewref: string, options: any = {}) {
    let view: View = this.getView(viewref);
    if (!view) {
      return;
    }
    // check existing card
    let card = null;
    this.cards.forEach(c => {
      if (c.id === id) {
        card = c;
      }
    });
    if (card) {
      return;
    }
    card = new CardModel(id);
    card.x = event.clientX;
    card.y = event.clientY;
    card.width = view.profile.width;
    card.height = view.profile.height;
    card.view = view;
    card.variablesMapping = options.variablesMapping;
    if (this.parentcards) {
      this.parentcards.push(card);
    } else {
      this.cards.push(card);
    }
  }

  openIframe(id: string, event: any, link: string, options: any) {
    // check existing iframe
    let iframe = null;
    this.iframes.forEach(f => {
      if (f.id === id) {
        iframe = f;
      }
    });
    if (iframe) {
      return;
    }
    iframe = new CardModel(id);
    iframe.x = event.clientX;
    iframe.y = event.clientY;
    iframe.width = 600;
    iframe.height = 400;
    iframe.scale = 1;
    if (!isNaN(parseInt(options.width))) {
      iframe.width = parseInt(options.width);
    }
    if (!isNaN(parseInt(options.height))) {
      iframe.height = parseInt(options.height);
    }
    if (!isNaN(parseFloat(options.scale))) {
      iframe.scale = parseFloat(options.scale);
    }

    iframe.link = link;
    iframe.name = link;
    this.iframes.push(iframe);
    this.onIframeResizing(iframe, {size: {width: iframe.width, height: iframe.height}});
  }

  onIframeResizing(iframe: CardModel, event) {
    iframe.width = event.size.width;
    iframe.height = event.size.height;
  }

  onCloseIframe(iframe: CardModel) {
    this.iframes.forEach(f => {
      if (f.id === iframe.id) {
        this.iframes.splice(this.cards.indexOf(f), 1);
      }
    });
  }

  openWindow(id: string, event: any, link: string, options: any) {
    let width = 600;
    let height = 400;
    if (!isNaN(parseInt(options.width))) {
      width = parseInt(options.width);
    }
    if (!isNaN(parseInt(options.height))) {
      height = parseInt(options.height);
    }
    window.open(link, '_blank', 'height=' + height + ',width=' + width + ',left=' + event.clientX + ',top=' + event.clientY);
  }

  onCloseCard(card: CardModel) {
    this.cards.splice(this.cards.indexOf(card), 1);
  }

  onCloseDialog() {
    delete this.dialog;
  }

  private onClose($event) {
    if (this.onclose) {
      this.onclose.emit($event);
    }
    // if (this.dialog && this.dialog.view && this.dialog.view.name === viewref) {
    // 	this.onCloseDialog();
    // } else if (this.cards.find((c) => c.name === viewref)) {
    // 	this.onCloseCard(this.cards.find((c) => c.name === viewref));
    // }
  }

  onSetValue(ga: GaugeSettings, event: GaugeEvent) {
    if (event.actparam) {
      let variableId = this.fetchVariableId(event) || ga.property.variableId
      this.gaugesManager.putSignalValue(variableId, event.actparam);
    }
  }

  onSetInput(ga: GaugeSettings, event: GaugeEvent) {
    if (event.actparam) {
      let ele = document.getElementById(event.actparam);
      if (ele) {
        let input = null;
        for (let i = 0; i < GaugesManager.GaugeWithInput.length; i++) {
          input = Utils.searchTreeStartWith(ele, GaugesManager.GaugeWithInput[i]);
          if (input) {
            break;
          }
        }
        if (input && !isNaN(input.value)) {
          let variableId = this.fetchVariableId(event) || ga.property.variableId
          this.gaugesManager.putSignalValue(variableId, input.value);
        }
      }
    }
  }

  getCardHeight(height) {
    return parseInt(height) + 4;
  }

  protected fetchVariableId(event) {
    if (!event.actoptions) {
      return null;
    }

    if (Utils.isObject(event.actoptions['variable']) && event.actoptions['variable']['variableId']) {
      return event.actoptions['variable']['variableId'];
    }
    // For legacy events
    if (event.actoptions['variableId']) {
      return event.actoptions['variableId'];
    }

    return null;
  }
}

export class CardModel {
  public id: string;
  public name: string;
  public link: string;
  public x: number;
  public y: number;
  public scale: number;
  public scaleX: number;
  public scaleY: number;
  public width: number;
  public height: number;
  public variablesMapping: any = [];
  public view: View;

  constructor(id: string) {
    this.id = id;
  }
}

export class DialogModalModel {
  public id: string;
  public name: string;
  public width: number;
  public height: number;
  public bkcolor: string;
  public view: View;
  public variablesMapping: any = [];

  constructor(id: string) {
    this.id = id;
  }
}

