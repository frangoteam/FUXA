import { Injectable, Output, EventEmitter } from '@angular/core';
import { Http, Headers, RequestOptions, Response } from '@angular/http';
import { Observable } from "rxjs/Observable";
import * as io from 'socket.io-client';

import { environment } from '../../environments/environment';
import { Device } from '../_models/device';
import { Hmi, Variable, GaugeSettings } from '../_models/hmi';
import { ProjectService } from '../_services/project.service';
import { EndPointApi } from '../_helpers/endpointapi';
import { ToastrService } from 'ngx-toastr';

@Injectable()
export class HmiService {

    // @Output() onSaveCurrent: EventEmitter<boolean> = new EventEmitter();
    @Output() onVariableChanged: EventEmitter<Variable> = new EventEmitter();
    @Output() onDeviceChanged: EventEmitter<boolean> = new EventEmitter();
    @Output() onDeviceBrowse: EventEmitter<any> = new EventEmitter();
    @Output() onDeviceNodeAttribute: EventEmitter<any> = new EventEmitter();

    public version = "1.00";
    public static separator = '^~^';
    public hmi: Hmi;
    hmiresource: string = "hmi-config";
    viewSignalGaugeMap = new ViewSignalGaugeMap();
    devices = {};
    variables = {};
    private socket;
    private endPointConfig: string = EndPointApi.getURL();//"http://localhost:1881";

    constructor(private projectService: ProjectService,
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
        // console.log('end set ' + sig.id + ' ' + sig.value);
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
        console.log('put ' + sigId + ' ' + value);
        if (this.variables[sigId]) {
            this.variables[sigId].value = value;
            if (this.socket) {
                this.socket.emit('device-values', { cmd: 'set', var: this.variables[sigId] });
            }
            // this.onVariableChanged.emit(this.variables[sigId]);
        }
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
                    this.toastr.error('Device "' + message.id + '" connection error!', '', {
                        timeOut: 3000,
                        closeButton: true,
                        // disableTimeOut: true
                    });
                }
                // console.log('dev-st ' + message);
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
            this.askDeviceValues();
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
    public askDeviceValues() {
        if (this.socket) {
            this.socket.emit('device-values', 'get');
        }
    }

    public getAllSignals() {
        return this.variables;
    }
    // public getMessages = () => {
    //     return Observable.create((observer) => {
    //         this.socket.on('device-status', (message) => {
    //             observer.next(message);
    //         });
    //     });
    // }

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
    //#endregion

    //#region Signals Gauges Mapping
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
     */
    removeSignalGaugeFromMap(domViewId: string) {
        this.viewSignalGaugeMap.remove(domViewId);
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
     * get all signals mapped in all dom views
     */
    getMappedVariables(): Variable[] {
        let result: Variable[] = [];
        this.viewSignalGaugeMap.getAllSignalIds().forEach(sigid => {
            if (this.variables[sigid]) {
                result.push(this.variables[sigid]);
            }
        });
        return result;
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