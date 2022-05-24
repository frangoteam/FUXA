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
import { Subscription } from "rxjs";
import { ChangeDetectorRef } from '@angular/core';

import { Event, GaugeEvent, GaugeEventActionType, GaugeSettings, GaugeProperty, GaugeEventType, GaugeRangeProperty, GaugeStatus, Hmi, View, ViewType, Variable } from '../_models/hmi';
import { GaugesManager } from '../gauges/gauges.component';
import { isUndefined } from 'util';
import { Utils } from '../_helpers/utils';
import { HmiService } from "../_services/hmi.service";
import { Script, ScriptParam, SCRIPT_PARAMS_MAP } from '../_models/script';
import { ScriptService } from '../_services/script.service';

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
    @ViewChild('inputDialogRef') inputDialogRef: ElementRef;
    @ViewChild('inputValueRef') inputValueRef: ElementRef;

    eventRunScript = Utils.getEnumKey(GaugeEventActionType, GaugeEventActionType.onRunScript);

    cards: CardModel[] = [];
    iframes: CardModel[] = [];
    dialog: DialogModalModel;
    mapGaugeStatus = {};
    inputDialog = { show: false, timer: null, x: 0, y: 0, target: null };
    gaugeInput = '';

    cardViewType = Utils.getEnumKey(ViewType, ViewType.cards);

    private subscriptionOnChange: Subscription;
    protected staticValues: any = {};
    protected plainVariableMapping: any = {};

    constructor(private el: ElementRef,
        private changeDetector: ChangeDetectorRef,
        private viewContainerRef: ViewContainerRef,
        private scriptService: ScriptService,
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
            console.error(err);
        }
    }

    ngAfterViewInit() {
        this.loadHmi(this.view);
        try {
            this.gaugesManager.emitBindedSignals(this.id);
        } catch (err) {
            console.error(err);
        }
    }

    ngOnDestroy() {
        try {
            this.gaugesManager.unbindGauge(this.id);
            this.clearGaugeStatus();
            if (this.subscriptionOnChange) {
                this.subscriptionOnChange.unsubscribe();
            }
        } catch (err) {
            console.error(err);
        }
    }

    private clearGaugeStatus() {
        Object.values(this.mapGaugeStatus).forEach((gs: GaugeStatus) => {
            try {
                if (gs.actionRef) {
                    if (gs.actionRef.timer) {
                        clearTimeout(gs.actionRef.timer);
                        gs.actionRef.timer = null;
                    }
                    if (gs.actionRef.animr) {
                        if (gs.actionRef.animr.reset) {
                            gs.actionRef.animr.reset();
                        }
                        delete gs.actionRef.animr;
                    }
                }
            } catch (err) {
                console.error(err);
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
            try {
                this.gaugesManager.unbindGauge(this.id);
                this.clearGaugeStatus();
                this.viewContainerRef.clear();
                this.dataContainer.nativeElement.innerHTML = '';
            } catch (err) {
                console.error(err);
            }
        }
        if (view) {
            this.id = view.id;
            this.view = view;
            if (view.type === this.cardViewType) {
                let cards = JSON.parse(view.svgcontent);
                if (cards.content) {
                    this.dataContainer.nativeElement.innerHTML = cards.content.replace('<title>Layer 1</title>', '');
                }
            } else {
                this.dataContainer.nativeElement.innerHTML = view.svgcontent.replace('<title>Layer 1</title>', '');
            }
            if (view.profile.bkcolor && this.child) {
                this.dataContainer.nativeElement.style.backgroundColor = view.profile.bkcolor;
            }
        }
        this.changeDetector.detectChanges();
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
                try {
                    let gauge = this.gaugesManager.initElementAdded(items[key], this.resolver, this.viewContainerRef, true);
                    this.gaugesManager.bindGauge(gauge, this.id, items[key],
                        (gaToBindMouseEvents) => {
                            this.onBindMouseEvents(gaToBindMouseEvents);
                        },
                        (gatobindhtmlevent) => {
                            this.onBindHtmlEvent(gatobindhtmlevent);
                        });
                    if (items[key].property) {
                        let gaugeSetting = items[key];
                        let gaugeStatus = this.getGaugeStatus(gaugeSetting);
                        let variables = [];
                        // prepare the start value to precess
                        if (items[key].property.variableValue && gaugeSetting.property.variableId) {
                            let variable: Variable = <Variable>{ id: gaugeSetting.property.variableId, value: gaugeSetting.property.variableValue };
                            if (this.checkStatusValue(gaugeSetting.id, gaugeStatus, variable)) {
                                variables = [variable];
                            }
                        }
                        // get the the last signal value in memory of gauge, is important that last one is the value (variableId)
                        variables = variables.concat(this.gaugesManager.getBindSignalsValue(items[key]));
                        if (variables.length) {
                            let svgeles = FuxaViewComponent.getSvgElements(gaugeSetting.id);
                            for (let y = 0; y < svgeles.length; y++) {
                                variables.forEach(variable => {
                                    this.gaugesManager.processValue(gaugeSetting, svgeles[y], variable, gaugeStatus);                                    
                                });
                            }
                        }
                    }

    
                } catch (err) {
                    console.error('loadWatch: ' + err);
                }    
            }
            if (!this.subscriptionOnChange) {
                this.subscriptionOnChange = this.gaugesManager.onchange.subscribe(this.handleSignal.bind(this));
            }
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
            let property = <GaugeProperty> items[gaId].property;
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
                    if (event.actoptions) {
                        if (Utils.isObject(event.actoptions['variable'])) {
                            this.applyVariableMappingTo(event.actoptions['variable']);
                        } else {
                            this.applyVariableMappingTo(event.actoptions);
                        }
                    }
                })
            }

            if (property.ranges) {
                property.ranges.forEach((range: GaugeRangeProperty) => {
                    if (range.textId) {
                        this.applyVariableMappingTo(range.textId);
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
            target.variableId = this.plainVariableMapping[target.variableId];
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
     * bind the gauge svg element with mouse events
     * @param ga
     */
    private onBindMouseEvents(ga: GaugeSettings) {
        let self = this;
        let svgele = FuxaViewComponent.getSvgElement(ga.id);
        if (svgele) {
            let clickEvents = self.gaugesManager.getBindMouseEvent(ga, GaugeEventType.click);
            if (clickEvents && clickEvents.length > 0) {
                svgele.click(function (ev) {
                    self.runEvents(self, ga, ev, clickEvents);
                });
            }
            let mouseDownEvents = self.gaugesManager.getBindMouseEvent(ga, GaugeEventType.mousedown);
            if (mouseDownEvents && mouseDownEvents.length > 0) {
                svgele.mousedown(function (ev) {
                    self.runEvents(self, ga, ev, mouseDownEvents);
                });
            }
            let mouseUpEvents = self.gaugesManager.getBindMouseEvent(ga, GaugeEventType.mouseup);
            if (mouseUpEvents && mouseUpEvents.length > 0) {
                svgele.mouseup(function (ev) {
                    self.runEvents(self, ga, ev, mouseUpEvents);
                });
            }
        }
    }

    private runEvents(self: any, ga: GaugeSettings, ev: any, events: any) {
        for (let i = 0; i < events.length; i++) {
            let actindex = Object.keys(GaugeEventActionType).indexOf(events[i].action);
            let eventTypes = Object.values(GaugeEventActionType);
            if (eventTypes.indexOf(GaugeEventActionType.onpage) === actindex) {
                self.loadPage(ev, events[i].actparam);
            } else if (eventTypes.indexOf(GaugeEventActionType.onwindow) === actindex) {
                self.onOpenCard(ga.id, ev, events[i].actparam, events[i].actoptions);
            } else if (eventTypes.indexOf(GaugeEventActionType.ondialog) === actindex) {
                self.openDialog(ev, events[i].actparam, events[i].actoptions);
            } else if (eventTypes.indexOf(GaugeEventActionType.onSetValue) === actindex) {
                self.onSetValue(ga, events[i]);
            } else if (eventTypes.indexOf(GaugeEventActionType.onToggleValue) === actindex) {
                self.onToggleValue(ga, events[i]);
            } else if (eventTypes.indexOf(GaugeEventActionType.onSetInput) === actindex) {
                self.onSetInput(ga, events[i]);
            } else if (eventTypes.indexOf(GaugeEventActionType.oniframe) === actindex) {
                self.openIframe(ga.id, ev, events[i].actparam, events[i].actoptions);
            } else if (eventTypes.indexOf(GaugeEventActionType.oncard) === actindex) {
                self.openWindow(ga.id, ev, events[i].actparam, events[i].actoptions);
            } else if (eventTypes.indexOf(GaugeEventActionType.onclose) === actindex) {
                self.onClose(ev);
            } else if (events[i].action === this.eventRunScript) {
                self.onRunScript(events[i]);
            }
        }
    }

    onToggleValue(ga: GaugeSettings, event: GaugeEvent) {
        if (event.actoptions && event.actoptions['variable'] && event.actoptions['variable']['variableId']) {
            this.gaugesManager.toggleSignalValue(event.actoptions['variable']['variableId']);
        } else if (ga.property && ga.property.variableId) {
            this.gaugesManager.toggleSignalValue(ga.property.variableId);
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
                    htmlevent.dbg = 'key pressed ' + htmlevent.dom.id + ' ' + htmlevent.dom.value;
                    htmlevent.id = htmlevent.dom.id;
                    htmlevent.value = htmlevent.dom.value;
                    self.gaugesManager.putEvent(htmlevent);
                }
            };
            if (this.hmi.layout.inputdialog === 'true') {
                htmlevent.dom.onfocus = function (ev) {
                    if (ev.currentTarget) {
                        var inputRect = ev.currentTarget.getBoundingClientRect();
                        self.toggleShowInputDialog(true, inputRect.left, inputRect.top, htmlevent);
                        self.toggleShowInputDialog(true, inputRect.left + ((inputRect.width < 80) ? -((80 - inputRect.width) / 2) : 0), inputRect.top - 5, htmlevent);
                        for (let i = 0; i < ev.currentTarget.attributes.length; i++)  {
                            if (ev.currentTarget.attributes['style']) {
                                self.setInputDialogStyle(self.inputDialogRef.nativeElement, ev.currentTarget.attributes['style'].textContent, inputRect);
                            }
                            
                        }
                        document.body.appendChild(self.inputDialogRef.nativeElement);
                        setTimeout(() => {
                            self.inputValueRef.nativeElement.focus();
                        }, 300);
                    }
                }
                htmlevent.dom.onblur = function (ev) {
                    self.toggleShowInputDialog(false);
                }
            }

        } else if (htmlevent.type === 'change') {
            htmlevent.dom.onchange = function (ev) {
                htmlevent.dbg = 'key pressed ' + htmlevent.dom.id + ' ' + htmlevent.dom.value;
                htmlevent.id = htmlevent.dom.id;
                htmlevent.value = htmlevent.dom.value;
                self.gaugesManager.putEvent(htmlevent);
            };
        }
    }

    private setInputDialogStyle(element: any, style: string, sourceBound: DOMRect) {
        for (let i = 0; i < element.children.length; i++) {
            let el = element.children[i];
            if (el.tagName.toLowerCase() === 'input') {
                el.value = '';
                style += 'width: ' + sourceBound.width + 'px !important;'; 
                el.setAttribute('style', style);
            }
        }
        element.style.backgroundColor = this.view.profile.bkcolor;
    }

    private getView(viewref: string): View {
        let view: View;
        for (let i = 0; i < this.hmi.views.length; i++) {
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

    static getSvgElement(svgid: string) {
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
        if (this.hmi.layout.hidenavigation) {
            card.y -= 48;
        }
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
        this.onIframeResizing(iframe, { size: { width: iframe.width, height: iframe.height } });
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
            let variableId = this.fetchVariableId(event) || ga.property.variableId;
            let fnc = this.fetchFunction(event);
            this.gaugesManager.putSignalValue(variableId, event.actparam, fnc);
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
                if (input && !Utils.isNullOrUndefined(input.value)) {
                    let variableId = this.fetchVariableId(event) || ga.property.variableId
                    this.gaugesManager.putSignalValue(variableId, input.value);
                }
            }
        }
    }

    onRunScript(event: GaugeEvent) {
        if (event.actparam) {
            let torun = new Script(event.actparam);
            torun.parameters = <ScriptParam[]>event.actoptions[SCRIPT_PARAMS_MAP];
            this.scriptService.runScript(torun).subscribe(result => {

            }, err => {
                console.error(err);
            });
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

    private fetchFunction(event) {
        if (event.actoptions && event.actoptions.function) {
            return event.actoptions.function;
        }
        return null;
    }
    
    toggleShowInputDialog(show: boolean, x: number = -1, y: number = -1, htmlev: Event = null) {
        if (show) {
            this.inputDialog.show = true;
            if (x >= 0 && y >= 0) {
                this.inputDialog.target = htmlev;
                this.inputDialog.x = x;
                this.inputDialog.y = y;
            }
            clearTimeout(this.inputDialog.timer);
        } else {
            this.inputDialog.timer = setTimeout(() => {
                this.inputDialog.show = false;
            }, 300);
        }
    }

    onNoClick() {

    }

    onOkClick(evintput) {
        if (this.inputDialog.target.dom) {
            this.inputDialog.target.dom.value = evintput;
            this.inputDialog.target.dbg = 'key pressed ' + this.inputDialog.target.dom.id + ' ' + this.inputDialog.target.dom.value;
            this.inputDialog.target.id = this.inputDialog.target.dom.id;
            this.inputDialog.target.value = this.inputDialog.target.dom.value;
            this.gaugesManager.putEvent(this.inputDialog.target);
        }
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
