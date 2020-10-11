import { Injectable, Output, EventEmitter } from '@angular/core';
import { Http, Headers, RequestOptions, Response } from '@angular/http';
import { Observable } from "rxjs";
import * as io from 'socket.io-client';

import { environment } from '../../environments/environment';
import { Device, Tag } from '../_models/device';
import { Hmi, Variable, GaugeSettings, DaqQuery, DaqResult } from '../_models/hmi';
import { AlarmEvent } from '../_models/alarm';
import { ProjectService } from '../_services/project.service';
import { EndPointApi } from '../_helpers/endpointapi';
import { ToastrService } from 'ngx-toastr';
import { TranslateService } from '@ngx-translate/core';

@Injectable()
export class HmiService {

    // @Output() onSaveCurrent: EventEmitter<boolean> = new EventEmitter();
    @Output() onVariableChanged: EventEmitter<Variable> = new EventEmitter();
    @Output() onDeviceChanged: EventEmitter<boolean> = new EventEmitter();
    @Output() onDeviceBrowse: EventEmitter<any> = new EventEmitter();
    @Output() onDeviceNodeAttribute: EventEmitter<any> = new EventEmitter();
    @Output() onDaqResult: EventEmitter<DaqResult> = new EventEmitter();
    @Output() onDeviceProperty: EventEmitter<any> = new EventEmitter();
    @Output() onHostInterfaces: EventEmitter<any> = new EventEmitter();
    @Output() onAlarmsStatus: EventEmitter<any> = new EventEmitter();

    public version = "1.00";
    public static separator = '^~^';
    public hmi: Hmi;
    hmiresource: string = "hmi-config";
    viewSignalGaugeMap = new ViewSignalGaugeMap();
    devices = {};
    variables = {};
    alarms = { highhigh: 0, high: 0, low: 0, info: 0};
    private socket;
    private endPointConfig: string = EndPointApi.getURL();//"http://localhost:1881";

    constructor(private projectService: ProjectService,
        private translateService: TranslateService,
        private toastr: ToastrService) {
        if (environment.serverEnabled) {
            this.initSocket();
        }
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
    putSignalValue(sigId: string, value: string) {
        if (this.variables[sigId]) {
            this.variables[sigId].value = value;
            if (this.socket) {
                this.socket.emit('device-values', { cmd: 'set', var: this.variables[sigId] });
            }
            // this.onVariableChanged.emit(this.variables[sigId]);
        }
    }

    
    public getAllSignals() {
        return this.variables;
    }

    //#region Scket.io
    /**
     * Init the socket and subsribe to device status and signal value change
     */
    public initSocket() {
        // check to init socket io
        if (!this.socket) {
            this.socket = io(this.endPointConfig);
            // devicse status
            this.socket.on('device-status', (message) => {
                this.onDeviceChanged.emit(message);
                if (message.status === 'connect-error') {
                    var msg = '';
                    this.translateService.get('msg.device-connection-error', { value: message.id }).subscribe((txt: string) => {msg = txt});                    
                    this.toastr.error(msg, '', {
                        timeOut: 3000,
                        closeButton: true,
                        // disableTimeOut: true
                    });
                }
            });
            // device property
            this.socket.on('device-property', (message) => {
                this.onDeviceProperty.emit(message);
            });  
            // devices values
            this.socket.on('device-values', (message) => {
                for (let idx = 0; idx < message.values.length; idx++) {
                    let varid = message.id + HmiService.separator + message.values[idx].id;
                    if (!this.variables[varid]) {
                        this.variables[varid] = new Variable(varid, message.id, message.values[idx].id);
                    }
                    this.variables[varid].value = message.values[idx].value;
                    this.setSignalValue(this.variables[varid]);
                }
            });
            // device browse
            this.socket.on('device-browse', (message) => {
                this.onDeviceBrowse.emit(message);
            });
            // device node attribute
            this.socket.on('device-node-attribute', (message) => {
                this.onDeviceNodeAttribute.emit(message);
            });
            // daq values
            this.socket.on('daq-result', (message) => {
                this.onDaqResult.emit(message);
            });
            // alarms status
            this.socket.on('alarms-status', (alarmsstatus) => {
                this.onAlarmsStatus.emit(alarmsstatus);
            });
            this.socket.on('host-interfaces', (message) => {
                this.onHostInterfaces.emit(message);
            });               

            this.askDeviceValues();
            this.askAlarmsStatus();
        }
    }

    /**
     * Ask device status to backend
     */
    public askDeviceStatus() {
        if (this.socket) {
            this.socket.emit('device-status', 'get');
        }
    }

    /**
     * Ask device status to backend
     */
    public askDeviceProperty(endpoint, type) {
        if (this.socket) {
            let msg = { endpoint: endpoint, type: type };
            this.socket.emit('device-property', msg);
        }
    }
    /**
     * Ask host interface available
     */
    public askHostInterface() {
        if (this.socket) {
            this.socket.emit('host-interfaces', 'get');
        } 
    }

    /**
     * Ask device status to backend
     */
    public askDeviceValues() {
        if (this.socket) {
            this.socket.emit('device-values', 'get');
        }
    }

    /**
     * Ask alarms status to backend
     */
    public askAlarmsStatus() {
        if (this.socket) {
            this.socket.emit('alarms-status', 'get');
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
            this.socket.emit('device-browse', msg);
        }
    }

    /**
     * Ask device node attribute to backend
     */
    public askNodeAttributes(deviceId: string, node: any) {
        if (this.socket) {
            let msg = { device: deviceId, node: node };
            this.socket.emit('device-node-attribute', msg);
        }
    }
    
    public queryDaqValues(msg: DaqQuery) {
        if (this.socket) {
            this.socket.emit('daq-query', msg);
        }
    }

    //#endregion

    //#region Signals Gauges Mapping
    addSignal(signalId: string, ga: GaugeSettings) {
        let sigsplit = signalId.split(HmiService.separator);
        // add to variable list
        if (!this.variables[signalId]) {
            let v = new Variable(signalId, sigsplit[0], sigsplit[1]);
            this.variables[signalId] = v;
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
        let sigsplit = signalId.split(HmiService.separator);
        // add to variable list
        if (!this.variables[signalId]) {
            let v = new Variable(signalId, sigsplit[0], sigsplit[1]);
            this.variables[signalId] = v;
        }
        // add to device list
        if (!this.devices[sigsplit[0]]) {
            this.devices[sigsplit[0]] = {};
            this.devices[sigsplit[0]] = sigsplit[1];
        } else if (!this.devices[sigsplit[0]][sigsplit[1]]) {
            this.devices[sigsplit[0]] = sigsplit[1];
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
            let gs: GaugeSettings = this.viewSignalGaugeMap.signalsGauges(domViewId, sigid);
            if (gs) {
                result[sigid] = gs[0].id;
            }
        }) 
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
                    let device = this.projectService.getDeviceFromSource(toadd.source);
                    if (device) {
                        toadd['source'] = device.name;
                        if (device.tags[toadd.name]) {
                            toadd['name'] = this.getTagLabel(device.tags[toadd.name]);
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
        if (this.variables[sigid]) {
            let result = this.variables[sigid];
            if (fulltext) {
                result = Object.assign({}, this.variables[sigid]);
                let device = this.projectService.getDeviceFromSource(result.source);
                if (device) {
                    result['source'] = device.name;
                    if (device.tags[result.name]) {
                        result['name'] = this.getTagLabel(device.tags[result.name]);
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

    //#region Chart functions
    getChart(id: string) {
        return this.projectService.getChart(id);
    }

    getChartSignal(id: string) {
        let chart = this.projectService.getChart(id);
        if (chart) {
            let varsId = [];
            chart.lines.forEach(line => {
                varsId.push(HmiService.toVariableId(line.device, line.id));
            });
            return varsId;
        }
    }
    //#endregion

    //#region Current Alarms functions
    getAlarmsValues() {
        return this.projectService.getAlarmsValues();
    }

    setAlarmAck(alarmName: string) {
        return this.projectService.setAlarmAck(alarmName);
    }

    //#endregion
    
    //#region My Static functions
    public static toVariableId(src: string, name: string) {
        return src + HmiService.separator + name;
    }
    //#endregion
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