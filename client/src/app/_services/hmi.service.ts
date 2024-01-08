import { Injectable, Output, EventEmitter } from '@angular/core';
import * as io from 'socket.io-client';

import { environment } from '../../environments/environment';
import { Tag, DeviceType } from '../_models/device';
import { Hmi, Variable, GaugeSettings, DaqQuery, DaqResult, GaugeEventSetValueType } from '../_models/hmi';
import { AlarmQuery } from '../_models/alarm';
import { ProjectService } from '../_services/project.service';
import { EndPointApi } from '../_helpers/endpointapi';
import { Utils } from '../_helpers/utils';
import { ToastrService } from 'ngx-toastr';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';
import { AuthService, UserProfile } from './auth.service';

@Injectable()
export class HmiService {

    @Output() onVariableChanged: EventEmitter<Variable> = new EventEmitter();
    @Output() onDeviceChanged: EventEmitter<boolean> = new EventEmitter();
    @Output() onDeviceBrowse: EventEmitter<any> = new EventEmitter();
    @Output() onDeviceNodeAttribute: EventEmitter<any> = new EventEmitter();
    @Output() onDaqResult: EventEmitter<DaqResult> = new EventEmitter();
    @Output() onDeviceProperty: EventEmitter<any> = new EventEmitter();
    @Output() onHostInterfaces: EventEmitter<any> = new EventEmitter();
    @Output() onAlarmsStatus: EventEmitter<any> = new EventEmitter();
    @Output() onDeviceWebApiRequest: EventEmitter<any> = new EventEmitter();
    @Output() onDeviceTagsRequest: EventEmitter<any> = new EventEmitter();
    @Output() onScriptConsole: EventEmitter<any> = new EventEmitter();
    @Output() onGoTo: EventEmitter<ScriptSetView> = new EventEmitter();

    onServerConnection$ = new BehaviorSubject<boolean>(false);

    public static separator = '^~^';
    public hmi: Hmi;
    viewSignalGaugeMap = new ViewSignalGaugeMap();
    variables = {};
    alarms = { highhigh: 0, high: 0, low: 0, info: 0 };
    private socket;
    private endPointConfig: string = EndPointApi.getURL();//"http://localhost:1881";
    private bridge: any = null;

    private addFunctionType = Utils.getEnumKey(GaugeEventSetValueType, GaugeEventSetValueType.add);
    private removeFunctionType = Utils.getEnumKey(GaugeEventSetValueType, GaugeEventSetValueType.remove);
    private homeTagsSubscription = [];
    private viewsTagsSubscription = [];

    constructor(public projectService: ProjectService,
        private translateService: TranslateService,
        private authService: AuthService,
        private toastr: ToastrService) {

        this.initSocket();

        this.projectService.onLoadHmi.subscribe(() => {
            this.hmi = this.projectService.getHmi();
        });

        this.authService.currentUser$.subscribe((userProfile: UserProfile) => {
           this.initSocket(userProfile?.token);
        });
    }

    /**
     * Set signal value in current frontend signal array
     * Called from Test and value beckame from backend
     * @param sig
     */
    setSignalValue(sig: Variable) {
        // update the signals array value

        // notify the gui
        this.onVariableChanged.emit(sig);
    }

    /**
     * Set signal value to backend
     * Value input in frontend
     * @param sigId
     * @param value
     */
    putSignalValue(sigId: string, value: string, fnc: string = null) {
        if (!this.variables[sigId]) {
            this.variables[sigId] = new Variable(sigId, null, null);
        }
        this.variables[sigId].value = this.getValueInFunction(this.variables[sigId].value, value, fnc);
        if (this.socket) {
            let device = this.projectService.getDeviceFromTagId(sigId);
            if (device) {
                this.variables[sigId]['source'] = device.id;
            }
            if (device?.type === DeviceType.internal) {
                this.variables[sigId].timestamp = new Date().getTime();
                this.setSignalValue(this.variables[sigId]);
            } else {
                this.socket.emit(IoEventTypes.DEVICE_VALUES, { cmd: 'set', var: this.variables[sigId], fnc: [fnc, value] });
            }
        } else if (this.bridge) {
            this.bridge.setDeviceValue(this.variables[sigId], { fnc: [fnc, value] });
        } else if (!environment.serverEnabled) {
            // for demo, only frontend
            this.setSignalValue(this.variables[sigId]);
        }
    }

    public getAllSignals() {
        return this.variables;
    }

    /**
     * return the value calculated with the function if defined
     * @param value
     * @param fnc
     */
    private getValueInFunction(current: any, value: string, fnc: string) {
        try {
            if (!fnc) {return value;}
            if (!current) {
                current = 0;
            }
            if (fnc === this.addFunctionType) {
                return parseFloat(current) + parseFloat(value);
            } else if (fnc === this.removeFunctionType) {
                return parseFloat(current) - parseFloat(value);
            }
        } catch (err) {
            console.error(err);
        }
        return value;
    }

    //#region Communication Socket.io and Bridge
    /**
     * Init the bridge for client communication
     * @param bridge
     * @returns
     */
    initClient(bridge?: any) {
        if (!bridge) {return false;}
        this.bridge = bridge;
        if (this.bridge) {
            this.bridge.onDeviceValues = (tags: Variable[]) => this.onDeviceValues(tags);
            this.askDeviceValues();
            return true;
        }
        return false;
    }

    private onDeviceValues(tags: Variable[]) {
        for (let idx = 0; idx < tags.length; idx++) {
            let varid = tags[idx].id;
            if (!this.variables[varid]) {
                this.variables[varid] = new Variable(varid, null, null);
            }
            this.variables[varid].value = tags[idx].value;
            this.variables[varid].error = tags[idx].error;
            this.setSignalValue(this.variables[varid]);
        }
    }

    /**
     * Init the socket and subsribe to device status and signal value change
     */
    public initSocket(token: string = null) {
        // check to init socket io
        if (!environment.serverEnabled) {
            return;
        }
        this.socket?.close();
        this.socket = io(`${this.endPointConfig}/?token=${token}`);
        this.socket.on('connect', () => {
            this.onServerConnection$.next(true);
        });
        this.socket.on('disconnect', () => {
            this.onServerConnection$.next(false);
        });
        // devicse status
        this.socket.on(IoEventTypes.DEVICE_STATUS, (message) => {
            this.onDeviceChanged.emit(message);
            if (message.status === 'connect-error' && this.hmi?.layout?.show_connection_error) {
                let name = message.id;
                let device = this.projectService.getDeviceFromId(message.id);
                if (device) {name = device.name;}
                let msg = '';
                this.translateService.get('msg.device-connection-error', { value: name }).subscribe((txt: string) => { msg = txt; });
                this.toastr.error(msg, '', {
                    timeOut: 3000,
                    closeButton: true,
                    // disableTimeOut: true
                });
            }
        });
        // device property
        this.socket.on(IoEventTypes.DEVICE_PROPERTY, (message) => {
            this.onDeviceProperty.emit(message);
        });
        // devices values
        this.socket.on(IoEventTypes.DEVICE_VALUES, (message) => {
            for (let idx = 0; idx < message.values.length; idx++) {
                let varid = message.values[idx].id;
                if (!this.variables[varid]) {
                    this.variables[varid] = new Variable(varid, null, null);
                }
                this.variables[varid].value = message.values[idx].value;
                this.variables[varid].timestamp = message.values[idx].timestamp;
                this.setSignalValue(this.variables[varid]);
            }
        });
        // device browse
        this.socket.on(IoEventTypes.DEVICE_BROWSE, (message) => {
            this.onDeviceBrowse.emit(message);
        });
        // device node attribute
        this.socket.on(IoEventTypes.DEVICE_NODE_ATTRIBUTE, (message) => {
            this.onDeviceNodeAttribute.emit(message);
        });
        // daq values
        this.socket.on(IoEventTypes.DAQ_RESULT, (message) => {
            this.onDaqResult.emit(message);
        });
        // alarms status
        this.socket.on(IoEventTypes.ALARMS_STATUS, (alarmsstatus) => {
            this.onAlarmsStatus.emit(alarmsstatus);
        });
        this.socket.on(IoEventTypes.HOST_INTERFACES, (message) => {
            this.onHostInterfaces.emit(message);
        });
        this.socket.on(IoEventTypes.DEVICE_WEBAPI_REQUEST, (message) => {
            this.onDeviceWebApiRequest.emit(message);
        });
        this.socket.on(IoEventTypes.DEVICE_TAGS_REQUEST, (message) => {
            this.onDeviceTagsRequest.emit(message);
        });
        // scripts
        this.socket.on(IoEventTypes.SCRIPT_CONSOLE, (message) => {
            this.onScriptConsole.emit(message);
        });
        this.socket.on(IoEventTypes.SCRIPT_COMMAND, (message) => {
            this.onScriptCommand(message);
        });

        this.askDeviceValues();
        this.askAlarmsStatus();
    }

    /**
     * Ask device status to backend
     */
    public askDeviceStatus() {
        if (this.socket) {
            this.socket.emit(IoEventTypes.DEVICE_STATUS, 'get');
        }
    }

    /**
     * Ask device status to backend
     */
    public askDeviceProperty(endpoint, type) {
        if (this.socket) {
            let msg = { endpoint: endpoint, type: type };
            this.socket.emit(IoEventTypes.DEVICE_PROPERTY, msg);
        }
    }

    /**
     * Ask device webapi result to test
     */
    public askWebApiProperty(property) {
        if (this.socket) {
            let msg = { property: property };
            this.socket.emit(IoEventTypes.DEVICE_WEBAPI_REQUEST, msg);
        }
    }

    /**
     * Ask device tags settings
     */
    public askDeviceTags(deviceId: string) {
        if (this.socket) {
            let msg = { deviceId: deviceId };
            this.socket.emit(IoEventTypes.DEVICE_TAGS_REQUEST, msg);
        }
    }

    /**
     * Ask host interface available
     */
    public askHostInterface() {
        if (this.socket) {
            this.socket.emit(IoEventTypes.HOST_INTERFACES, 'get');
        }
    }

    /**
     * Ask device status to backend
     */
    public askDeviceValues() {
        if (this.socket) {
            this.socket.emit(IoEventTypes.DEVICE_VALUES, 'get');
        } else if (this.bridge) {
            this.bridge.getDeviceValues(null);
        }
    }

    /**
     * Ask alarms status to backend
     */
    public askAlarmsStatus() {
        if (this.socket) {
            this.socket.emit(IoEventTypes.ALARMS_STATUS, 'get');
        }
    }

    public emitMappedSignalsGauge(domViewId: string) {
        let sigsToEmit = this.viewSignalGaugeMap.getSignalIds(domViewId);
        for (let idx = 0; idx < sigsToEmit.length; idx++) {
            if (this.variables[sigsToEmit[idx]]) {
                this.setSignalValue(this.variables[sigsToEmit[idx]]);
            }
        }
    }

    /**
     * Ask device browse to backend
     */
    public askDeviceBrowse(deviceId: string, node: any) {
        if (this.socket) {
            let msg = { device: deviceId, node: node };
            this.socket.emit(IoEventTypes.DEVICE_BROWSE, msg);
        }
    }

    /**
     * Ask device node attribute to backend
     */
    public askNodeAttributes(deviceId: string, node: any) {
        if (this.socket) {
            let msg = { device: deviceId, node: node };
            this.socket.emit(IoEventTypes.DEVICE_NODE_ATTRIBUTE, msg);
        }
    }

    public queryDaqValues(msg: DaqQuery) {
        if (this.socket) {
            this.socket.emit(IoEventTypes.DAQ_QUERY, msg);
        }
    }

    private tagsSubscribe() {
        if (this.socket) {
            const mergedArray = this.viewsTagsSubscription.concat(this.homeTagsSubscription);
            let msg = { tagsId: [...new Set(mergedArray)] };
            this.socket.emit(IoEventTypes.DEVICE_TAGS_SUBSCRIBE, msg);
        }
    }

    /**
     * Subscribe views tags values
     */
    public viewsTagsSubscribe(tagsId: string[]) {
        this.viewsTagsSubscription = tagsId;
        this.tagsSubscribe();
    }

    /**
     * Subscribe only home tags value
     */
    public homeTagsSubscribe(tagsId: string[]) {
        this.homeTagsSubscription = tagsId;
        this.tagsSubscribe();
    }

    /**
     * Unsubscribe to tags values
     */
    public tagsUnsubscribe(tagsId: string[]) {
        if (this.socket) {
            let msg = { tagsId: tagsId };
            this.socket.emit(IoEventTypes.DEVICE_TAGS_UNSUBSCRIBE, msg);
        }
    }
    //#endregion

    //#region Signals Gauges Mapping
    addSignal(signalId: string, ga: GaugeSettings) {
        // add to variable list
        if (!this.variables[signalId]) {
            this.variables[signalId] = new Variable(signalId, null, this.projectService.getDeviceFromTagId(signalId));
        }
    }

    /**
     * map the dom view with signal and gauge settings
     * @param domViewId
     * @param signalId
     * @param ga
     */
    addSignalGaugeToMap(domViewId: string, signalId: string, ga: GaugeSettings) {
        this.viewSignalGaugeMap.add(domViewId, signalId, ga);
        // add to variable list
        if (!this.variables[signalId]) {
            this.variables[signalId] = new Variable(signalId, null, this.projectService.getDeviceFromTagId(signalId));
        }
    }

    /**
     * remove mapped dom view Gauges
     * @param domViewId
     * return the removed gauge settings id list with signal id binded
     */
    removeSignalGaugeFromMap(domViewId: string) {
        let sigsIdremoved = this.viewSignalGaugeMap.getSignalIds(domViewId);
        let result = {};
        sigsIdremoved.forEach(sigid => {
            let gaugesSettings: GaugeSettings[] = this.viewSignalGaugeMap.signalsGauges(domViewId, sigid);
            if (gaugesSettings) {
                result[sigid] = gaugesSettings.map(gs => gs.id);
            }
        });
        this.viewSignalGaugeMap.remove(domViewId);
        return result;
    }

    /**
     * get the gauges settings list of mapped dom view with the signal
     * @param domViewId
     * @param sigid
     */
    getMappedSignalsGauges(domViewId: string, sigid: string): GaugeSettings[] {
        return Object.values(this.viewSignalGaugeMap.signalsGauges(domViewId, sigid));
    }

    /**
     * get all signals property mapped in all dom views
     * @param fulltext a copy with item name and source
     */
    getMappedVariables(fulltext: boolean): Variable[] {
        let result: Variable[] = [];
        this.viewSignalGaugeMap.getAllSignalIds().forEach(sigid => {
            if (this.variables[sigid]) {
                let toadd = this.variables[sigid];
                if (fulltext) {
                    toadd = Object.assign({}, this.variables[sigid]);
                    let device = this.projectService.getDeviceFromTagId(toadd.id);
                    if (device) {
                        toadd['source'] = device.name;
                        if (device.tags[toadd.id]) {
                            toadd['name'] = this.getTagLabel(device.tags[toadd.id]);
                        }
                    }
                }
                result.push(toadd);
            }
        });
        return result;
    }

    /**
     * get singal property, complate the signal property with device tag property
     * @param sigid
     * @param fulltext
     */
    getMappedVariable(sigid: string, fulltext: boolean): Variable {
        if (!this.variables[sigid]) {return null;}

        if (this.variables[sigid]) {
            let result = this.variables[sigid];
            if (fulltext) {
                result = Object.assign({}, this.variables[sigid]);
                let device = this.projectService.getDeviceFromTagId(result.id);
                if (device) {
                    result['source'] = device.name;
                    if (device.tags[result.id]) {
                        result['name'] = this.getTagLabel(device.tags[result.id]);
                    }
                }
            }
            return result;
        }
    }

    private getTagLabel(tag: Tag) {
        if (tag.label) {
            return tag.label;
        } else {
            return tag.name;
        }
    }

    //#endregion

    //#region Chart and Graph functions
    getChart(id: string) {
        return this.projectService.getChart(id);
    }

    getChartSignal(id: string) {
        let chart = this.projectService.getChart(id);
        if (chart) {
            let varsId = [];
            chart.lines.forEach(line => {
                varsId.push(line.id);
            });
            return varsId;
        }
    }

    getGraph(id: string) {
        return this.projectService.getGraph(id);
    }

    getGraphSignal(id: string) {
        let graph = this.projectService.getGraph(id);
        if (graph) {
            let varsId = [];
            graph.sources.forEach(source => {
                varsId.push(source.id);
            });
            return varsId;
        }
    }
    //#endregion

    //#region Current Alarms functions
    getAlarmsValues() {
        return this.projectService.getAlarmsValues();
    }

    getAlarmsHistory(query: AlarmQuery) {
        return this.projectService.getAlarmsHistory(query);
    }

    setAlarmAck(alarmName: string) {
        return this.projectService.setAlarmAck(alarmName);
    }
    //#endregion

    //#region DAQ functions served from project service
    getDaqValues(query: DaqQuery) {
        return this.projectService.getDaqValues(query);
    }
    //#endregion

    //#region My Static functions
    public static toVariableId(src: string, name: string) {
        return src + HmiService.separator + name;
    }

    //#endregion

    private onScriptCommand(message: ScriptCommandMessage) {
        switch (message.command) {
            case ScriptCommandEnum.SETVIEW:
                if (message.params && message.params.length) {
                    this.onGoTo.emit(<ScriptSetView>{ viewName: message.params[0], force: message.params[1] });
                }
                break;
        }
    }
}

class ViewSignalGaugeMap {
    views = {};

    public add(domViewId: string, signalId: string, ga: GaugeSettings) {
        if (!this.views[domViewId]) {
            this.views[domViewId] = {};
        }
        if (!this.views[domViewId][signalId]) {
            this.views[domViewId][signalId] = [];
        }
        this.views[domViewId][signalId].push(ga);
        return true;
    }

    public remove(domViewId: string) {
        delete this.views[domViewId];
        return;
    }

    public signalsGauges(domViewId: string, sigid: string) {
        return this.views[domViewId][sigid];
    }

    public getSignalIds(domViewId: string) {
        let result: string[] = [];
        if (this.views[domViewId]) {
            result = Object.keys(this.views[domViewId]);
        }
        return result;
    }

    public getAllSignalIds() {
        let result: string[] = [];
        Object.values(this.views).forEach(evi => {
            Object.keys(evi).forEach(key => {
                if (result.indexOf(key) === -1) {
                    result.push(key);
                }
            });
        });
        return result;
    }
}

export enum IoEventTypes {
    DEVICE_STATUS = 'device-status',
    DEVICE_PROPERTY = 'device-property',
    DEVICE_VALUES = 'device-values',
    DEVICE_BROWSE = 'device-browse',
    DEVICE_NODE_ATTRIBUTE = 'device-node-attribute',
    DEVICE_WEBAPI_REQUEST = 'device-webapi-request',
    DEVICE_TAGS_REQUEST = 'device-tags-request',
    DEVICE_TAGS_SUBSCRIBE = 'device-tags-subscribe',
    DEVICE_TAGS_UNSUBSCRIBE = 'device-tags-unsubscribe',
    DAQ_QUERY = 'daq-query',
    DAQ_RESULT = 'daq-result',
    DAQ_ERROR = 'daq-error',
    ALARMS_STATUS = 'alarms-status',
    HOST_INTERFACES = 'host-interfaces',
    SCRIPT_CONSOLE = 'script-console',
    SCRIPT_COMMAND = 'script-command'
}

const ScriptCommandEnum = {
    SETVIEW: 'SETVIEW',
};

interface ScriptCommandMessage {
    command: string;
    params: any[];
}

export interface ScriptSetView {
    viewName: string;
    force: boolean;
}
