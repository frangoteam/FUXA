import {
    AfterViewInit,
    Component,
    ComponentFactoryResolver,
    ElementRef,
    EventEmitter,
    HostListener,
    Input,
    OnDestroy,
    OnInit,
    Output,
    ViewChild,
    ViewContainerRef
} from '@angular/core';
import { Subscription } from 'rxjs';
import { ChangeDetectorRef } from '@angular/core';

import { Event, GaugeEvent, GaugeEventActionType, GaugeSettings, GaugeProperty, GaugeEventType, GaugeRangeProperty, GaugeStatus, Hmi, View, ViewType, Variable, ZoomModeType } from '../_models/hmi';
import { GaugesManager } from '../gauges/gauges.component';
import { Utils } from '../_helpers/utils';
import { ScriptParam, SCRIPT_PARAMS_MAP, ScriptParamType } from '../_models/script';
import { ScriptService } from '../_services/script.service';
import { HtmlInputComponent } from '../gauges/controls/html-input/html-input.component';
import { TranslateService } from '@ngx-translate/core';
import { ProjectService } from '../_services/project.service';
import { NgxTouchKeyboardDirective } from '../framework/ngx-touch-keyboard/ngx-touch-keyboard.directive';
import { HmiService } from '../_services/hmi.service';

declare var SVG: any;

@Component({
    selector: 'app-fuxa-view',
    templateUrl: './fuxa-view.component.html',
    styleUrls: ['./fuxa-view.component.css']
})
export class FuxaViewComponent implements OnInit, AfterViewInit, OnDestroy {

    @Input() id: string;
    @Input() variablesMapping: any = [];
    @Input() view: View;
    @Input() hmi: Hmi;
    @Input() child = false;
    @Input() gaugesManager: GaugesManager;        // gauges.component
    @Input() parentcards: CardModel[];
    @Output() onclose = new EventEmitter();
    @Output() ongoto: EventEmitter<string> = new EventEmitter();

    @ViewChild('dataContainer', {static: false}) dataContainer: ElementRef;
    @ViewChild('inputDialogRef', {static: false}) inputDialogRef: ElementRef;
    @ViewChild('inputValueRef', {static: false}) inputValueRef: ElementRef;
    @ViewChild('touchKeyboard', {static: false}) touchKeyboard: NgxTouchKeyboardDirective;

    eventRunScript = Utils.getEnumKey(GaugeEventActionType, GaugeEventActionType.onRunScript);
    scriptParameterValue = Utils.getEnumKey(ScriptParamType, ScriptParamType.value);

    cards: CardModel[] = [];
    iframes: CardModel[] = [];
    dialog: DialogModalModel;
    mapGaugeStatus = {};
    inputDialog = { show: false, timer: null, x: 0, y: 0, target: null };
    gaugeInput = '';
    gaugeInputCurrent = '';

    cardViewType = Utils.getEnumKey(ViewType, ViewType.cards);

    private subscriptionOnChange: Subscription;
    protected staticValues: any = {};
    protected plainVariableMapping: any = {};
    private subscriptionLoad: Subscription;

    constructor(
        private translateService: TranslateService,
        private changeDetector: ChangeDetectorRef,
        private viewContainerRef: ViewContainerRef,
        private scriptService: ScriptService,
        private projectService: ProjectService,
        private hmiService: HmiService,
        private resolver: ComponentFactoryResolver) {
    }

    ngOnInit() {
        try {
            if (this.variablesMapping) {
                this.variablesMapping.forEach(variableMapping => {
                    this.plainVariableMapping[variableMapping.from.variableId] = variableMapping.to.variableId;
                });
            }
        } catch (err) {
            console.error(err);
        }
    }

    ngAfterViewInit() {
        this.loadHmi(this.view);
        /* check if already loaded */
        if (this.projectService.getHmi()) {
            this.projectService.initScheduledScripts();
        } else {
            this.subscriptionLoad = this.projectService.onLoadHmi.subscribe(
                load => {this.projectService.initScheduledScripts();
            });
        }
        try {
            this.gaugesManager.emitBindedSignals(this.id);
        } catch (err) {
            console.error(err);
        }
    }

    ngOnDestroy() {
        try {
			if (this.subscriptionLoad) {
				this.subscriptionLoad.unsubscribe();
			}
            this.projectService.clearScheduledScripts();
            this.gaugesManager.unbindGauge(this.id);
            this.clearGaugeStatus();
            if (this.subscriptionOnChange) {
                this.subscriptionOnChange.unsubscribe();
            }
            if (this.inputDialogRef) {
                this.inputDialogRef.nativeElement.style.display = 'none';
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
                this.ongoto.emit(view.id);
                return;
            } else {
                this.dataContainer.nativeElement.innerHTML = view.svgcontent.replace('<title>Layer 1</title>', '');
            }
            if (view.profile.bkcolor && this.child) {
                this.dataContainer.nativeElement.style.backgroundColor = view.profile.bkcolor;
            }
        }
        this.changeDetector.detectChanges();
        this.loadWatch(this.view);
        // // @ts-ignore
        // window.dispatchEvent(new window.Event('resize'));
    }


    @HostListener('window:resize', ['$event'])
    onResize(event) {
        let hmi = this.projectService.getHmi();
        if (hmi && hmi.layout && ZoomModeType[hmi.layout.zoom] === ZoomModeType.autoresize) {
            Utils.resizeView('.home-body');
        }
    }

    /**
     * load all gauge settings, bind gauge with signals, bind gauge event
     * @param view
     */
    private loadWatch(view: View) {
        if (view && view.items) {
            let items = this.applyVariableMapping(view.items);
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
            // set subscription to server
            this.hmiService.viewsTagsSubscribe(this.gaugesManager.getBindedSignalsId());
        }
    }

    protected handleSignal(sig) {
        if (sig.value !== undefined) {
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
                });
            }

            if (property.ranges) {
                property.ranges.forEach((range: GaugeRangeProperty) => {
                    if (range.textId) {
                        this.applyVariableMappingTo(range.textId);
                    }
                });
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
                svgele.click(function(ev) {
                    self.runEvents(self, ga, ev, clickEvents);
                });
                svgele.touchstart(function(ev) {
                    self.runEvents(self, ga, ev, clickEvents);
                });

            }
            let mouseDownEvents = self.gaugesManager.getBindMouseEvent(ga, GaugeEventType.mousedown);
            if (mouseDownEvents && mouseDownEvents.length > 0) {
                svgele.mousedown(function(ev) {
                    self.runEvents(self, ga, ev, mouseDownEvents);
                });
            }
            let mouseUpEvents = self.gaugesManager.getBindMouseEvent(ga, GaugeEventType.mouseup);
            if (mouseUpEvents && mouseUpEvents.length > 0) {
                svgele.mouseup(function(ev) {
                    self.runEvents(self, ga, ev, mouseUpEvents);
                });
            }
        }
    }

    public runEvents(self: any, ga: GaugeSettings, ev: any, events: any) {
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

    private setInputValidityMessage(result: any, el: any){
        if(result.errorText === 'html-input.out-of-range'){
            el.setCustomValidity(`${this.translateService.instant(result.errorText)}. ${this.translateService.instant('html-input.min')}=${result.min}, ${this.translateService.instant('html-input.max')}=${result.max}`);
        } else{
            el.setCustomValidity(this.translateService.instant(result.errorText));
        }
        el.reportValidity();
    }

    /**
     * bind the html input control with key-enter event and select control with change event
     * @param htmlevent
     */
    private onBindHtmlEvent(htmlevent: Event) {
        let self = this;
        // let htmlevent = this.getHtmlElement(ga.id);
        if (htmlevent.type === 'key-enter') {
            htmlevent.dom.onkeydown = function(ev) {
                if (ev.key == 'Enter') {
                    htmlevent.dbg = 'key pressed ' + htmlevent.dom.id + ' ' + htmlevent.dom.value;
                    htmlevent.id = htmlevent.dom.id;
                    htmlevent.value = htmlevent.dom.value;
                    let res = HtmlInputComponent.validateValue(htmlevent.dom.value, htmlevent.ga);
                    if(!res.valid){
                        self.setInputValidityMessage(res, htmlevent.dom);
                    }
                    else{
                        self.gaugesManager.putEvent(htmlevent);
                        htmlevent.dom.blur();
                    }
                    if (htmlevent.ga.type === HtmlInputComponent.TypeTag) {
                        const events = JSON.parse(JSON.stringify(HtmlInputComponent.getEvents(htmlevent.ga.property, GaugeEventType.enter)));
                        events.forEach(ev => {
                            if (htmlevent.value) {
                                let parameters = <ScriptParam[]>ev.actoptions[SCRIPT_PARAMS_MAP];
                                parameters.forEach(param => {
                                    if (param.type === self.scriptParameterValue && !param.value) {
                                        param.value = htmlevent.value;
                                    }
                                });
                            }
                            self.onRunScript(ev);
                        });
                    }
                } else if (ev.key == 'Escape') {
                    htmlevent.dom.blur();
                }
            };
            if (this.hmi.layout.inputdialog === 'true') {
                htmlevent.dom.onfocus = function(ev) {
                    if (ev.currentTarget) {
                        var inputRect = ev.currentTarget.getBoundingClientRect();

                        self.toggleShowInputDialog(true, inputRect.left + ((inputRect.width < 80) ? -((80 - inputRect.width) / 2) : 0) - 7, inputRect.top - 8, htmlevent);

                        for (let i = 0; i < ev.currentTarget.attributes.length; i++)  {
                            if (ev.currentTarget.attributes['style']) {
                                self.setInputDialogStyle(self.inputDialogRef.nativeElement, ev.currentTarget.attributes['style'].textContent, inputRect);
                            }
                        }
                        self.gaugeInputCurrent = htmlevent.dom.value;
                        document.body.appendChild(self.inputDialogRef.nativeElement);

                        setTimeout(() => {
                            self.inputValueRef.nativeElement.focus();
                        }, 300);
                    }
                };
            } else {
                // Register events to remove and add unit on input focus and blur. We don'w want units to be part of input value during editing
                // When input dialog is enabled, these event gets overridden (by binding of HtmlEvent) and are not called.
                if (this.hmi.layout?.inputdialog === 'keyboard' && htmlevent.ga?.type === HtmlInputComponent.TypeTag) {
                    htmlevent.dom.onfocus = function(ev) {
                        self.touchKeyboard.closePanel();
                        let eleRef = new ElementRef(htmlevent.dom);
                        if (htmlevent.ga?.property?.options?.numeric) {
                            eleRef.nativeElement.inputMode = 'decimal';
                        }
                        self.touchKeyboard.openPanel(eleRef);
                        // if(htmlevent.ga.property){
                        //     let unit = HtmlInputComponent.getUnit(htmlevent.ga.property, new GaugeStatus());
                        //     if(unit && htmlevent.dom.value.endsWith(unit)){
                        //         let len = htmlevent.dom.value.length;
                        //         htmlevent.dom.value = htmlevent.dom.value.substr(0, len - unit.length - 1);
                        //     }
                        //     htmlevent.dom.select();
                        // }
                    };
                }

                htmlevent.dom.onblur = function(ev) {
                    // Update variable value in case it has changed while input had focus
                    let variables = self.gaugesManager.getBindSignalsValue(htmlevent.ga);
                    let svgeles = FuxaViewComponent.getSvgElements(htmlevent.ga.id);

                    if (variables.length && svgeles.length) {
                        self.gaugesManager.processValue(htmlevent.ga, svgeles[0], variables[0], new GaugeStatus());
                    }
                    // Remove any error message when input is blured
                    htmlevent.dom.setCustomValidity('');
                };

                htmlevent.dom.oninput = function(ev){
                    // Remove any error message when input changes
                    htmlevent.dom.setCustomValidity('');
                };
            }
        } else if (htmlevent.type === 'change') {
            htmlevent.dom.onchange = function(ev) {
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
        card.x = event.clientX + (Utils.isNumeric(options.left) ? parseInt(options.left) : 0);
        card.y = event.clientY + (Utils.isNumeric(options.top) ? parseInt(options.top) : 0);
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
        iframe.x = Utils.isNumeric(options.left) ? parseInt(options.left) : event.clientX;
        iframe.y = Utils.isNumeric(options.top) ? parseInt(options.top) : event.clientY;
        iframe.width = Utils.isNumeric(options.width) ? parseInt(options.width) : 600;
        iframe.height = Utils.isNumeric(options.height) ? parseInt(options.height) : 400;
        iframe.scale = Utils.isNumeric(options.scale) ? parseFloat(options.scale) : 1;
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
        const width = Utils.isNumeric(options.width) ? parseInt(options.width) : 600;
        const height = Utils.isNumeric(options.height) ? parseInt(options.height) : 400;
        const left = Utils.isNumeric(options.left) ? parseInt(options.left) : event.clientX;
        const top = Utils.isNumeric(options.top) ? parseInt(options.top) : event.clientY;
        window.open(link, '_blank', `height=${height},width=${width},left=${left},top=${top}`);
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
                for (let i = 0; i < GaugesManager.GaugeWithProperty.length; i++) {
                    input = Utils.searchTreeStartWith(ele, GaugesManager.GaugeWithProperty[i]);
                    if (input) {
                        break;
                    }
                }
                if (input && !Utils.isNullOrUndefined(input.value)) {
                    let variableId = this.fetchVariableId(event) || ga.property.variableId;
                    this.gaugesManager.putSignalValue(variableId, input.value);
                }
            }
        }
    }

    onRunScript(event: GaugeEvent) {
        if (event.actparam) {
            let torun = this.projectService.getScripts().find(dataScript => dataScript.id == event.actparam);
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
            // Evaluate top/bottom coordinate and adjust to dialog position to fit into window. We know that dialog height is 112
            let d = self.innerHeight - (y + 114);

            if(y < 0){
                y = 0;
            }else if(d < 0){
                y += d;
            }

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
                this.gaugeInputCurrent = '';
            }, 300);
        }
    }

    onNoClick() {

    }

    inputOnChange(){
        // Remove any error message when input changes
        this.inputValueRef.nativeElement.setCustomValidity('');
    }

    onOkClick(evintput) {
        if (this.inputDialog.target.dom) {
            let res = HtmlInputComponent.validateValue(evintput, this.inputDialog.target.ga);
            if(!res.valid){
                this.setInputValidityMessage(res, this.inputValueRef.nativeElement);
            }
            else{
                this.inputValueRef.nativeElement.setCustomValidity('');
                this.inputDialog.target.dom.value = evintput;
                this.inputDialog.target.dbg = 'key pressed ' + this.inputDialog.target.dom.id + ' ' + this.inputDialog.target.dom.value;
                this.inputDialog.target.id = this.inputDialog.target.dom.id;
                this.inputDialog.target.value = this.inputDialog.target.dom.value;
                this.gaugesManager.putEvent(this.inputDialog.target);
            }
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
