import { Injectable, Output, EventEmitter } from '@angular/core';
import { HmiService } from '../_services/hmi.service';
import { ChartRangeType, ChartViewType } from '../_models/chart';

import { GaugeSettings, Variable, Event, GaugeEvent, GaugeEventType, GaugeStatus, Size, DaqQuery, TableType } from '../_models/hmi';
import { ValueComponent } from './controls/value/value.component';
import { GaugeDialogType } from './gauge-property/gauge-property.component';
import { HtmlInputComponent } from './controls/html-input/html-input.component';
import { HtmlButtonComponent } from './controls/html-button/html-button.component';
import { HtmlSelectComponent } from './controls/html-select/html-select.component';
import { HtmlChartComponent } from './controls/html-chart/html-chart.component';
import { HtmlGraphComponent } from './controls/html-graph/html-graph.component';
import { HtmlBagComponent } from './controls/html-bag/html-bag.component';
import { HtmlSwitchComponent } from './controls/html-switch/html-switch.component';
import { GaugeProgressComponent } from './controls/gauge-progress/gauge-progress.component';
import { GaugeSemaphoreComponent } from './controls/gauge-semaphore/gauge-semaphore.component';
import { ShapesComponent } from './shapes/shapes.component';
import { ProcEngComponent } from './shapes/proc-eng/proc-eng.component';
import { ApeShapesComponent } from './shapes/ape-shapes/ape-shapes.component';
import { PipeComponent } from './controls/pipe/pipe.component';
import { SliderComponent } from './controls/slider/slider.component';

import { WindowRef } from '../_helpers/windowref';
import { Utils } from '../_helpers/utils';
import { ChartUplotComponent } from './controls/html-chart/chart-uplot/chart-uplot.component';
import { NgxGaugeComponent } from '../gui-helpers/ngx-gauge/ngx-gauge.component';
import { NgxNouisliderComponent } from '../gui-helpers/ngx-nouislider/ngx-nouislider.component';
import { GraphBaseComponent } from './controls/html-graph/graph-base/graph-base.component';
import { HtmlIframeComponent } from './controls/html-iframe/html-iframe.component';
import { HtmlTableComponent } from './controls/html-table/html-table.component';
import { DataTableComponent } from './controls/html-table/data-table/data-table.component';
import { ChartOptions } from '../gui-helpers/ngx-uplot/ngx-uplot.component';
import { GaugeBaseComponent } from './gauge-base/gauge-base.component';
import { HtmlImageComponent } from './controls/html-image/html-image.component';
import { PanelComponent } from './controls/panel/panel.component';
import { FuxaViewComponent } from '../fuxa-view/fuxa-view.component';

@Injectable()
export class GaugesManager {

    @Output() onchange: EventEmitter<Variable> = new EventEmitter();
    @Output() onevent: EventEmitter<Event> = new EventEmitter();

    // signalGaugeMap = new ViewSignalGaugeMap();      // map of all gauges (GaugeSettings) pro signals

    // map of gauges that have a click/html event
    eventGauge: MapGaugesSetting = {};
    // map of gauges with views
    mapGaugeView = {};
    // map of all signals and binded gauges of current view
    memorySigGauges = {};

    mapChart = {};
    mapGauges = {};
    mapTable = {};

    // list of gauges tags to speed up the check
    gaugesTags = [];

    // list of gauges with input
    static GaugeWithProperty = [HtmlInputComponent.prefix, HtmlSelectComponent.prefix, HtmlSwitchComponent.prefix];
    // list of gauges tags to check who as events like mouse click
    static GaugeWithEvents = [HtmlButtonComponent.TypeTag, GaugeSemaphoreComponent.TypeTag, ShapesComponent.TypeTag, ProcEngComponent.TypeTag,
        ApeShapesComponent.TypeTag, HtmlImageComponent.TypeTag, HtmlInputComponent.TypeTag, PanelComponent.TypeTag, HtmlSelectComponent.TypeTag];
    // list of gauges tags to check who as events like mouse click
    static GaugeWithActions = [ApeShapesComponent, PipeComponent, ProcEngComponent, ShapesComponent, HtmlButtonComponent, HtmlSelectComponent,
        ValueComponent, HtmlInputComponent, GaugeSemaphoreComponent, HtmlImageComponent, PanelComponent];
    // list of gauges components
    static Gauges = [ValueComponent, HtmlInputComponent, HtmlButtonComponent, HtmlBagComponent,
        HtmlSelectComponent, HtmlChartComponent, GaugeProgressComponent, GaugeSemaphoreComponent, ShapesComponent, ProcEngComponent, ApeShapesComponent,
        PipeComponent, SliderComponent, HtmlSwitchComponent, HtmlGraphComponent, HtmlIframeComponent, HtmlTableComponent,
        HtmlImageComponent, PanelComponent];

    constructor(private hmiService: HmiService,
        private winRef: WindowRef) {
        // subscription to the change of variable value, then emit to the gauges of fuxa-view
        this.hmiService.onVariableChanged.subscribe(sig => {
            try {
                this.onchange.emit(sig);
            } catch (err) {

            }
        });
        // subscription to DAQ values, then emit to charts gauges of fuxa-view
        this.hmiService.onDaqResult.subscribe(message => {
            try {
                if (this.mapChart[message.gid]) {
                    let gauge: ChartUplotComponent = this.mapChart[message.gid];
                    gauge.setValues(message.result);
                } else if (this.mapTable[message.gid]) {
                    let gauge: DataTableComponent = this.mapTable[message.gid];
                    gauge.setValues(message.result);
                }
            } catch (err) {

            }
        });
        this.hmiService.getGaugeMapped = this.getGaugeFromName.bind(this);
        // make the list of gauges tags to speed up the check
        GaugesManager.Gauges.forEach(g => {
            this.gaugesTags.push(g.TypeTag);
        });
    }

    createSettings(id: string, type: string) {
        let gs: GaugeSettings = null;
        if (type) {
            for (let i = 0; i < GaugesManager.Gauges.length; i++) {
                if (type.startsWith(GaugesManager.Gauges[i].TypeTag)) {
                    gs = new GaugeSettings(id, type);
                    gs.label = GaugesManager.Gauges[i].LabelTag;
                    return gs;
                }
            }
        }
        return gs;
    }

    createGaugeStatus(ga: GaugeSettings): GaugeStatus {
        let result = new GaugeStatus();
        if (!ga.type.startsWith(HtmlChartComponent.TypeTag) && !ga.type.startsWith(HtmlGraphComponent.TypeTag) &&
            !ga.type.startsWith(HtmlTableComponent.TypeTag)) {
            result.onlyChange = true;
        }
        if (ga.type.startsWith(SliderComponent.TypeTag)) {
            result.takeValue = true;
        }
        return result;
    }

    isWithEvents(type) {
        if (type) {
            for (let i = 0; i < GaugesManager.GaugeWithEvents.length; i++) {
                if (type.startsWith(GaugesManager.GaugeWithEvents[i])) {
                    return true;
                }
            }
        }
        return false;
    }

    isWithActions(type) {
        if (type) {
            for (let i = 0; i < GaugesManager.GaugeWithActions.length; i++) {
                if (type.startsWith(GaugesManager.GaugeWithActions[i].TypeTag)) {
                    if (typeof GaugesManager.GaugeWithActions[i]['getActions'] === 'function') {
                        return GaugesManager.GaugeWithActions[i]['getActions'](type);
                    }
                }
            }
        }
        return false;
    }

    /**
     * Return if is a gauge by check the svg attribute 'type' = 'svg-ext-...'
     * @param type
     * @returns
     */
    isGauge(type: string) {
        for (let tag in this.gaugesTags) {
            if (type.startsWith(this.gaugesTags[tag])) {
                return true;
            }
        }
        return false;
    }

    /**
     * gauges to update in editor after changed property (GaugePropertyComponent, ChartPropertyComponent)
     * @param ga
     */
    initInEditor(ga: GaugeSettings, res: any, ref: any) {
        if (ga.type.startsWith(GaugeProgressComponent.TypeTag)) {
            GaugeProgressComponent.initElement(ga);
        } else if (ga.type.startsWith(HtmlButtonComponent.TypeTag)) {
            HtmlButtonComponent.initElement(ga);
        } else if (ga.type.startsWith(HtmlChartComponent.TypeTag)) {
            delete this.mapGauges[ga.id];
            let gauge = HtmlChartComponent.detectChange(ga, res, ref);
            this.setChartPropety(gauge, ga.property);
            this.mapGauges[ga.id] = gauge;
        } else if (ga.type.startsWith(HtmlGraphComponent.TypeTag)) {
            delete this.mapGauges[ga.id];
            let gauge = HtmlGraphComponent.detectChange(ga, res, ref);
            this.setGraphPropety(gauge, ga.property);
            this.mapGauges[ga.id] = gauge;
        } else if (ga.type.startsWith(HtmlBagComponent.TypeTag)) {
            this.mapGauges[ga.id] = HtmlBagComponent.detectChange(ga, res, ref);
        } else if (ga.type.startsWith(PipeComponent.TypeTag)) {
            return this.mapGauges[ga.id] = PipeComponent.detectChange(ga, res, this.winRef);
        } else if (ga.type.startsWith(SliderComponent.TypeTag)) {
            return this.mapGauges[ga.id] = SliderComponent.detectChange(ga, res, ref);
        } else if (ga.type.startsWith(HtmlSwitchComponent.TypeTag)) {
            return this.mapGauges[ga.id] = HtmlSwitchComponent.detectChange(ga, res, ref);
        } else if (ga.type.startsWith(HtmlIframeComponent.TypeTag)) {
            HtmlIframeComponent.detectChange(ga);
        } else if (ga.type.startsWith(HtmlTableComponent.TypeTag)) {
            delete this.mapGauges[ga.id];
            let gauge = HtmlTableComponent.detectChange(ga, res, ref);
            this.setTablePropety(gauge, ga.property);
            this.mapGauges[ga.id] = gauge;
        }
        return false;
    }

    /**
     * emit the signal value to the frontend, used for user_defined variable to make logic in frontend
     * @param sigId
     * @param value
     */
    setSignalValue(sigId: string, value: any) {
        let variable = new Variable(sigId, null, null);
        variable.value = value;
        this.onchange.emit(variable);
    }

    //! toremove
    initGaugesMap() {
        this.eventGauge = {};
        this.mapGaugeView = {};
    }

    /**
     * called from fuxa-view, is used to emit message for a refresh of all signals values and the gauges of view
     * @param domViewId
     */
    emitBindedSignals(domViewId: string) {
        this.hmiService.emitMappedSignalsGauge(domViewId);
    }
    /**
     * called from fuxa-view, bind dom view, gauge with signal (for animation) and event
     * @param gaugekey
     * @param gauge
     * @param domViewId
     * @param ga
     * @param bindclick
     * @param bindhtmlevent
     */
    bindGauge(gauge: any, domViewId: string, ga: GaugeSettings, bindMouseEvent: any, bindhtmlevent: any) {
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
        let mouseEvents: GaugeEvent[] = this.getBindMouseEvent(ga, null);
        if (mouseEvents && mouseEvents.length > 0) {
            this.eventGauge[ga.id] = ga;
            if (!this.mapGaugeView[ga.id]) {
                this.mapGaugeView[ga.id] = {};
                this.mapGaugeView[ga.id][domViewId] = ga;
                bindMouseEvent(ga);
            } else if (!this.mapGaugeView[ga.id][domViewId]) {
                this.mapGaugeView[ga.id][domViewId] = ga;
                bindMouseEvent(ga);
            }
            // add pointer
            let ele = document.getElementById(ga.id);
            if (ele) {
                ele.style.cursor = 'pointer';
            }
        }
        let htmlEvents = this.getHtmlEvents(ga);
        if (htmlEvents) {
            this.eventGauge[htmlEvents.dom.id] = ga;
            bindhtmlevent(htmlEvents);
        }
        this.bindGaugeEventToSignal(ga);
        this.checkElementToInit(ga);
    }


    /**
     * @param domViewId
     * called from fuxa-view, remove bind of dom view gauge
     */
    unbindGauge(domViewId: string) {
        // first remove special gauge like chart from memorySigGauges
        let sigGaugeSettingsIdremoved = this.hmiService.removeSignalGaugeFromMap(domViewId);
        Object.keys(sigGaugeSettingsIdremoved).forEach(sid => {
            if (this.memorySigGauges[sid]) {
                for (let i = 0; i < sigGaugeSettingsIdremoved[sid].length; i++) {
                    let gsId = sigGaugeSettingsIdremoved[sid][i];
                    if (this.memorySigGauges[sid][gsId]) {
                        let g = this.memorySigGauges[sid][gsId];
                        try {
                            if (g.myComRef) {
                                g.myComRef.destroy();
                            }
                            delete this.memorySigGauges[sid][gsId];
                            if (this.mapChart[g.id]) {
                                delete this.mapChart[g.id];
                            }
                            if (this.mapGauges[g.id]) {
                                delete this.mapGauges[g.id];
                            }
                            if (this.mapTable[g.id]) {
                                delete this.mapTable[g.id];
                            }
                        } catch (err) {
                            console.error(err);
                        }
                    }
                }
            }
        });

        // remove mapped gauge for events of this view
        Object.values(this.mapGaugeView).forEach(val => {
            if (val[domViewId]) {
                let g = val[domViewId];
                if (g.myComRef) {
                    g.myComRef.destroy();
                }
                delete val[domViewId];
            }
        });
    }

    /**
     * init element of fuxa-view,
     * @param ga
     */
    checkElementToInit(ga: GaugeSettings) {
        if (ga.type.startsWith(HtmlSelectComponent.TypeTag)) {
            return HtmlSelectComponent.initElement(ga, true);
        }
        return null;
    }

    checkElementToResize(ga: GaugeSettings, res: any, ref: any, size: Size) {
        if (ga && this.mapGauges[ga.id]) {
            if (typeof this.mapGauges[ga.id]['resize'] === 'function') {
                let height, width;
                if (size) {
                    height = size.height;
                    width = size.width;
                }
                this.mapGauges[ga.id]['resize'](height, width);
            } else {
                for (let i = 0; i < GaugesManager.Gauges.length; i++) {
                    if (ga.type.startsWith(GaugesManager.Gauges[i].TypeTag)) {
                        if (typeof GaugesManager.Gauges[i]['resize'] === 'function') {
                            let options;
                            if (this.mapGauges[ga.id].options) {
                                options = this.mapGauges[ga.id].options;
                            }
                            return GaugesManager.Gauges[i]['resize'](ga, res, ref, options);
                        }
                        return;
                    }
                }
            }
        }
    }

    getGaugeFromName(gaugeName: string) {
        const gauge = Object.values(this.mapGauges).find((gauge: any) => gauge.name === gaugeName);
        return gauge;
    }

    getGaugeValue(gaugeId: string) {
        if (this.mapGauges[gaugeId] && this.mapGauges[gaugeId].currentValue) {
            return this.mapGauges[gaugeId].currentValue();
        }
    }

    /**
     * get all gauge settings binded to dom view with the signal
     * @param domViewId
     * @param sigid
     */
    getGaugeSettings(domViewId: string, sigid: string): GaugeSettings[] {
        let gslist = this.hmiService.getMappedSignalsGauges(domViewId, sigid);
        return gslist;
    }

    /**
     * get all signals mapped in all dom views, used from LabComponent
     * @param fulltext a copy with item name and source
     */
    getMappedGaugesSignals(fulltext: boolean) {
        return this.hmiService.getMappedVariables(fulltext);
    }

    /**
     * return all signals binded to the gauge
     * @param ga
     */
    getBindSignals(ga: GaugeSettings) {
        if (ga.property) {
            for (let i = 0; i < GaugesManager.Gauges.length; i++) {
                if (ga.type.startsWith(GaugesManager.Gauges[i].TypeTag)) {
                    if (ga.type.startsWith(HtmlChartComponent.TypeTag)) {
                        let sigs = this.hmiService.getChartSignal(ga.property.id);
                        return sigs;
                    } else if (ga.type.startsWith(HtmlGraphComponent.TypeTag)) {
                        let sigs = this.hmiService.getGraphSignal(ga.property.id);
                        return sigs;
                    } else if (typeof GaugesManager.Gauges[i]['getSignals'] === 'function') {
                        return GaugesManager.Gauges[i]['getSignals'](ga.property);
                    } else {
                        return null;
                    }
                }
            }
        }
        return null;
    }


    getBindSignalsValue(ga: GaugeSettings): Variable[] {
        let signals = this.getBindSignals(ga);
        let result = [];
        if (signals) {
            signals.forEach(sigId => {
                let variable = this.hmiService.getMappedVariable(sigId, false);
                if (variable && !Utils.isNullOrUndefined(variable.value)) {
                    result.push(variable);
                }
            });
        }
        return result;
    }

    /**
     * return all events binded to the gauge with mouse event
     * @param ga
     */
     getBindMouseEvent(ga: GaugeSettings, evType: GaugeEventType) {
        for (let i = 0; i < GaugesManager.Gauges.length; i++) {
            if (ga.type.startsWith(GaugesManager.Gauges[i].TypeTag)) {
                if (typeof GaugesManager.Gauges[i]['getEvents'] === 'function') {
                    return GaugesManager.Gauges[i]['getEvents'](ga.property, evType);
                } else {
                    return null;
                }
            }
        }
        return null;
    }

    /**
     * return all events binded to the html gauge ('key-enter' of input, 'change' of select)
     * @param ga
     */
    getHtmlEvents(ga: GaugeSettings): Event {
        if (ga.type.startsWith(HtmlInputComponent.TypeTag)) {
            return HtmlInputComponent.getHtmlEvents(ga);
        } else if (ga.type.startsWith(HtmlSelectComponent.TypeTag)) {
            return HtmlSelectComponent.getHtmlEvents(ga);
        }
        return null;
    }

    bindGaugeEventToSignal(ga: GaugeSettings) {
        if (ga.type.startsWith(SliderComponent.TypeTag)) {
            let self = this;
            SliderComponent.bindEvents(ga, this.mapGauges[ga.id], (event) => {
                self.putEvent(event);
            });
        } else if (ga.type.startsWith(HtmlSwitchComponent.TypeTag)) {
            let self = this;
            HtmlSwitchComponent.bindEvents(ga, this.mapGauges[ga.id], (event) => {
                self.putEvent(event);
            });
        }
    }

    /**
     * manage to which gauge to forward the process function
     * @param ga
     * @param svgele
     * @param sig
     */
    processValue(ga: GaugeSettings, svgele: any, sig: Variable, gaugeStatus: GaugeStatus) {
        gaugeStatus.variablesValue[sig.id] = sig.value;
        for (let i = 0; i < GaugesManager.Gauges.length; i++) {
            if (ga.type.startsWith(GaugesManager.Gauges[i].TypeTag)) {
                if (ga.type.startsWith(HtmlChartComponent.TypeTag)) {
                    if (ga.property.type === ChartViewType.realtime1 && this.memorySigGauges[sig.id]) {
                        Object.keys(this.memorySigGauges[sig.id]).forEach(k => {
                            if (k === ga.id && this.mapGauges[k]) {
                                HtmlChartComponent.processValue(ga, svgele, sig, gaugeStatus, this.mapGauges[k]);
                            }
                        });
                    }
                    break;
                } else if (ga.type.startsWith(HtmlGraphComponent.TypeTag)) {
                    if (ga.property.type !== 'history' && this.memorySigGauges[sig.id]) {
                        Object.keys(this.memorySigGauges[sig.id]).forEach(k => {
                            if (k === ga.id && this.mapGauges[k]) {
                                HtmlGraphComponent.processValue(ga, svgele, sig, gaugeStatus, this.mapGauges[k]);
                            }
                        });
                    }
                    break;
                } else if (ga.type.startsWith(HtmlBagComponent.TypeTag)) {
                    Object.keys(this.memorySigGauges[sig.id]).forEach(k => {
                        if (k === ga.id && this.mapGauges[k]) {
                            HtmlBagComponent.processValue(ga, svgele, sig, gaugeStatus, this.mapGauges[k]);
                        }
                    });
                    break;
                } else if (ga.type.startsWith(SliderComponent.TypeTag)) {
                    Object.keys(this.memorySigGauges[sig.id]).forEach(k => {
                        if (k === ga.id && this.mapGauges[k]) {
                            SliderComponent.processValue(ga, svgele, sig, gaugeStatus, this.mapGauges[k]);
                        }
                    });
                    break;
                } else if (ga.type.startsWith(HtmlSwitchComponent.TypeTag)) {
                    Object.keys(this.memorySigGauges[sig.id]).forEach(k => {
                        if (k === ga.id && this.mapGauges[k]) {
                            HtmlSwitchComponent.processValue(ga, svgele, sig, gaugeStatus, this.mapGauges[k]);
                        }
                    });
                    break;
                } else if (ga.type.startsWith(HtmlTableComponent.TypeTag)) {
                    if ((ga.property.type === TableType.data || ga.property.options?.realtime) && this.memorySigGauges[sig.id]) {
                        Object.keys(this.memorySigGauges[sig.id]).forEach(k => {
                            if (k === ga.id && this.mapGauges[k]) {
                                HtmlTableComponent.processValue(ga, svgele, sig, gaugeStatus, this.mapGauges[k]);
                            }
                        });
                    }
                    break;
                } else if (ga.type.startsWith(PanelComponent.TypeTag)) {
                    if (this.memorySigGauges[sig.id]) {
                        Object.keys(this.memorySigGauges[sig.id]).forEach(k => {
                            if (k === ga.id && this.mapGauges[k]) {
                                PanelComponent.processValue(ga, svgele, sig, gaugeStatus, this.mapGauges[k]);
                            }
                        });
                    }
                    break;
                } else if (typeof GaugesManager.Gauges[i]['processValue'] === 'function') {
                    GaugesManager.Gauges[i]['processValue'](ga, svgele, sig, gaugeStatus);
                    break;
                } else {
                    break;
                }
            }
        }
    }

    toggleSignalValue(sigid: string) {
        if (this.hmiService.variables.hasOwnProperty(sigid)) {
            let currentValue = this.hmiService.variables[sigid].value;
            if (currentValue === null || currentValue === undefined){
                return;
            } else {
                if (currentValue === 0 || currentValue === '0') {
                    this.putSignalValue(sigid, '1');
                } else if (currentValue === 1 || currentValue === '1') {
                    this.putSignalValue(sigid, '0');
                } else if (currentValue === 'false') {
                    this.putSignalValue(sigid, 'true');
                } else {
                    this.putSignalValue(sigid, String(!currentValue));
                }
            }
        }
    }

    /**
     * called from fuxa-view to emit and send signal value from a gauge event ('key-enter' of input, 'change' of select)
     * @param event
     */
    putEvent(event: Event) {
        if (event.ga.property && event.ga.property.variableId) {
            const value = GaugeBaseComponent.valueBitmask(event.ga.property.bitmask, event.value, this.hmiService.variables[event.ga.property.variableId]?.value);
            this.hmiService.putSignalValue(event.ga.property.variableId, String(value));
            event.dbg = 'put ' + event.ga.property.variableId + ' ' + event.value;
        }
        this.onevent.emit(event);
    }

    /**
     * called from fuxa-view to emit and send signal value from a gauge event (click)
     * @param sigid
     * @param val
     */
    putSignalValue(sigid: string, val: string, fnc: string = null) {
        this.hmiService.putSignalValue(sigid, val, fnc);
    }

    static getEditDialogTypeToUse(type: string): GaugeDialogType {
        for (let i = 0; i < GaugesManager.Gauges.length; i++) {
            if (type.startsWith(GaugesManager.Gauges[i].TypeTag)) {
                if (typeof GaugesManager.Gauges[i]['getDialogType'] === 'function') {
                    return GaugesManager.Gauges[i]['getDialogType']();
                } else {
                    return null;
                }
            }
        }
    }

    static isBitmaskSupported(type: string): boolean {
        for (let i = 0; i < GaugesManager.Gauges.length; i++) {
            if (type.startsWith(GaugesManager.Gauges[i].TypeTag)) {
                if (typeof GaugesManager.Gauges[i]['isBitmaskSupported'] === 'function') {
                    return GaugesManager.Gauges[i]['isBitmaskSupported']();
                } else {
                    return false;
                }
            }
        }
        return false;
    }

    /**
     * used from controls in editor to get default value of edit gauge property
     */
    static getDefaultValue(type: string): any {
        if (type.startsWith(GaugeProgressComponent.TypeTag)) {
            return GaugeProgressComponent.getDefaultValue();
        }
        return null;
    }

    /**
     * used from controls in editor, to set the colorpicker of selected control
     */
    static checkGaugeColor(ele: any, eles: any, colors: any): boolean {
        if (ele && ele.type && eles && (eles.length <= 1 || !eles[1]) && colors) {
            if (ele.type.startsWith(GaugeProgressComponent.TypeTag)) {
                colors.fill = GaugeProgressComponent.getFillColor(eles[0]);
                colors.stroke = GaugeProgressComponent.getStrokeColor(eles[0]);
                return true;
            } else if (ele.type.startsWith(GaugeSemaphoreComponent.TypeTag)) {
                colors.fill = GaugeSemaphoreComponent.getFillColor(eles[0]);
                colors.stroke = GaugeSemaphoreComponent.getStrokeColor(eles[0]);
                return true;
            } else if (ele.type.startsWith(HtmlButtonComponent.TypeTag)) {
                colors.fill = HtmlButtonComponent.getFillColor(eles[0]);
                colors.stroke = HtmlButtonComponent.getStrokeColor(eles[0]);
                return true;
            } else if (ele.type.startsWith(HtmlInputComponent.TypeTag)) {
                colors.fill = HtmlInputComponent.getFillColor(eles[0]);
                colors.stroke = HtmlInputComponent.getStrokeColor(eles[0]);
                return true;
            } else if (ele.type.startsWith(HtmlSelectComponent.TypeTag)) {
                colors.fill = HtmlSelectComponent.getFillColor(eles[0]);
                colors.stroke = HtmlSelectComponent.getStrokeColor(eles[0]);
                return true;
            }
        }
        return false;
    }

    /**
     * used from controls in editor to change fill and stroke colors
     * @param bkcolor
     * @param color
     * @param elements
     */
    static initElementColor(bkcolor, color, elements) {
        var elems = elements.filter(function(el) { return el; });
        for (let i = 0; i < elems.length; i++) {
            let type = elems[i].getAttribute('type');
            if (type) {
                if (type.startsWith(GaugeProgressComponent.TypeTag)) {
                    GaugeProgressComponent.initElementColor(bkcolor, color, elems[i]);
                } else if (type.startsWith(HtmlButtonComponent.TypeTag)) {
                    HtmlButtonComponent.initElementColor(bkcolor, color, elems[i]);
                } else if (type.startsWith(HtmlInputComponent.TypeTag)) {
                    HtmlInputComponent.initElementColor(bkcolor, color, elems[i]);
                } else if (type.startsWith(HtmlSelectComponent.TypeTag)) {
                    HtmlSelectComponent.initElementColor(bkcolor, color, elems[i]);
                }
            }
        }
    }


    /**
     * Return the default prefix of gauge name
     * @param type
     */
    static getPrefixGaugeName(type: string) {
        if (type.startsWith(GaugeProgressComponent.TypeTag)) {
            return 'progress_';
        } else if (type.startsWith(HtmlButtonComponent.TypeTag)) {
            return 'button_';
        } else if (type.startsWith(HtmlInputComponent.TypeTag)) {
            return 'input_';
        } else if (type.startsWith(HtmlSelectComponent.TypeTag)) {
            return 'select_';
        } else if (type.startsWith(GaugeSemaphoreComponent.TypeTag)) {
            return 'led_';
        } else if (type.startsWith(SliderComponent.TypeTag)) {
            return 'slider_';
        } else if (type.startsWith(PipeComponent.TypeTag)) {
            return 'pipe_';
        } else if (type.startsWith(HtmlChartComponent.TypeTag)) {
            return 'chart_';
        } else if (type.startsWith(HtmlGraphComponent.TypeTag)) {
            return 'graph_';
        } else if (type.startsWith(HtmlBagComponent.TypeTag)) {
            return 'gauge_';
        } else if (type.startsWith(HtmlSwitchComponent.TypeTag)) {
            return 'switch_';
        } else if (type.startsWith(HtmlIframeComponent.TypeTag)) {
            return 'iframe_';
        } else if (type.startsWith(ValueComponent.TypeTag)) {
            return 'output_';
        } else if (type.startsWith(HtmlTableComponent.TypeTag)) {
            return 'table_';
        }
        return 'shape_';
    }

    /**
     * initialize the gauge element found in svg view and editor, like ngx-uplot, ngx-gauge
     * in svg is only a 'div' that have to be dynamic build and render from angular
     * @param ga gauge settings
     * @param res reference to factory
     * @param ref reference to factory
     * @param isview in view or editor, in editor have to disable mouse activity
     * @param parent parent that call the function, should be from a FuxaViewComponent
     */
    initElementAdded(ga: GaugeSettings, res: any, ref: any, isview: boolean, parent?: FuxaViewComponent) {
        if (!ga || !ga.type) {
            console.error('!TOFIX', ga);
            return null;
        }
        // add variable
        let sigsid: string[] = this.getBindSignals(ga);
        if (sigsid) {
            for (let i = 0; i < sigsid.length; i++) {
                this.hmiService.addSignal(sigsid[i], ga);
            }
        }
        if (ga.type.startsWith(HtmlChartComponent.TypeTag)) {
            // prepare attribute
            let gauge: ChartUplotComponent = HtmlChartComponent.initElement(ga, res, ref, isview, ChartRangeType);
            if (gauge) {
                this.setChartPropety(gauge, ga.property);
                this.mapChart[ga.id] = gauge;
                gauge.onTimeRange.subscribe(data => {
                    this.hmiService.queryDaqValues(data);
                });
                if (isview) {
                    gauge.setInitRange();
                }
                this.mapGauges[ga.id] = gauge;
            }
            return gauge;
        } else if (ga.type.startsWith(HtmlGraphComponent.TypeTag)) {
            let gauge: GraphBaseComponent = HtmlGraphComponent.initElement(ga, res, ref, isview);
            if (gauge) {
                this.setGraphPropety(gauge, ga.property);
                gauge.onReload.subscribe((query: DaqQuery) => {
                    this.hmiService.getDaqValues(query).subscribe(result => {
                        gauge.setValues(query.sids, result);
                    }, err => {
                        gauge.setValues(query.sids, null);
                        console.error('get DAQ values err: ' + err);
                    });
                });
                this.mapGauges[ga.id] = gauge;
            }
            return gauge;
        } else if (ga.type.startsWith(HtmlBagComponent.TypeTag)) {
            let gauge: NgxGaugeComponent = HtmlBagComponent.initElement(ga, res, ref, isview);
            this.mapGauges[ga.id] = gauge;
            return gauge;
        } else if (ga.type.startsWith(SliderComponent.TypeTag)) {
            let gauge: NgxNouisliderComponent = SliderComponent.initElement(ga, res, ref, isview);
            this.mapGauges[ga.id] = gauge;
            return gauge;
        } else if (ga.type.startsWith(HtmlInputComponent.TypeTag)) {
            let gauge = HtmlInputComponent.initElement(ga, isview);
            return gauge || true;
        } else if (ga.type.startsWith(HtmlSelectComponent.TypeTag)) {
            let gauge = HtmlSelectComponent.initElement(ga, isview);
            return gauge || true;
        } else if (ga.type.startsWith(GaugeProgressComponent.TypeTag)) {
            let gauge = GaugeProgressComponent.initElement(ga);
            return gauge || true;
        } else if (ga.type.startsWith(HtmlSwitchComponent.TypeTag)) {
            let gauge = HtmlSwitchComponent.initElement(ga, res, ref, isview);
            this.mapGauges[ga.id] = gauge;
            return gauge;
        } else if (ga.type.startsWith(HtmlTableComponent.TypeTag)) {
            let gauge = HtmlTableComponent.initElement(ga, res, ref, isview);
            if (gauge) {
                this.setTablePropety(gauge, ga.property);
                this.mapTable[ga.id] = gauge;
                gauge.onTimeRange$.subscribe(data => {
                    this.hmiService.queryDaqValues(data);
                });
                this.mapGauges[ga.id] = gauge;
            }
            return gauge;
        } else if (ga.type.startsWith(HtmlIframeComponent.TypeTag)) {
            let gauge = HtmlIframeComponent.initElement(ga, isview);
            return gauge || true;
        } else if (ga.type.startsWith(HtmlImageComponent.TypeTag)) {
            let gauge = HtmlImageComponent.initElement(ga, isview);
            return gauge || true;
        } else if (ga.type.startsWith(PanelComponent.TypeTag)) {
            let gauge: FuxaViewComponent = PanelComponent.initElement(ga, res, ref, this, this.hmiService.hmi, isview, parent);
            this.mapGauges[ga.id] = gauge;
            return gauge;
        } else {
            let ele = document.getElementById(ga.id);
            ele?.setAttribute('data-name', ga.name);
            return ele || true;
        }
    }

    /**
     * add the chart settings (line) and property options to the gauge
     * @param gauge
     * @param chart
     * @param property
     */
    private setChartPropety(gauge: ChartUplotComponent, property: any) {
        if (property) {
            if (property.id) {
                let chart = this.hmiService.getChart(property.id);
                if (chart) {
                    const opt = <ChartOptions>{ ...property.options, ...{ title: chart.name, id: chart.name, scales: { x: { time: true } } } };
                    gauge.setOptions(opt, true);
                    let yaxisNotOne = chart.lines.find(line => line.yaxis > 1);
                    for (let i = 0; i < chart.lines.length; i++) {
                        let line = chart.lines[i];
                        let sigid = line.id;
                        let sigProperty = this.hmiService.getMappedVariable(sigid, true);
                        if (sigProperty) {
                            gauge.addLine(sigid, sigProperty.name, line, yaxisNotOne?true:false);
                        }
                    }
                    gauge.redraw();
                }
            } else {
                gauge.setOptions(property.options, true);
            }
        }
    }

    private setGraphPropety(gauge: GraphBaseComponent, property: any) {
        if (property) {
            if (property.id) {
                let graph = this.hmiService.getGraph(property.id);
                if (graph) {
                    gauge.init(graph.name, graph.property, graph.sources);
                }
            }
            if (property.options) {
                gauge.setOptions(property.options);
            }
        }
    }

    private setTablePropety(gauge: DataTableComponent, property: any) {
        if (property) {
            // if (property.id) {
            //     let graph = this.hmiService.getGraph(property.id);
            //     if (graph) {
            //         gauge.init(graph.name, graph.property, graph.sources);
            //     }
            // }
            if (property.options) {
                gauge.setOptions(property.options);
            }
        }
    }

    /**
     * clear memory object used from view, some reset
     */
    clearMemory() {
        this.memorySigGauges = {};
    }

    /**
     *
     * @returns list of signals id (tag) that are binded to a gauge
     */
    getBindedSignalsId() {
        return Object.keys(this.memorySigGauges);
    }
}

interface MapGaugesSetting {
    [x: string]: GaugeSettings;
}
