
import { Injectable, Output, EventEmitter } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { Hmi } from '../_models/hmi';
import { Device, DeviceType, DeviceNetProperty } from '../_models/device';
import { EndPointApi } from '../_helpers/endpointapi';
import { ToastrService } from 'ngx-toastr';

import * as FileSaver from 'file-saver';

@Injectable()
export class ProjectService {

    @Output() onSaveCurrent: EventEmitter<boolean> = new EventEmitter();
    @Output() onLoadHmi: EventEmitter<boolean> = new EventEmitter();

    public version = '1.00';
    public separator = '^~^';
    public started = false;
    private projectData: ProjectData;
    public serverSettings: any;

    private prjresource = 'prj-data';
    private endPointConfig: string = EndPointApi.getURL(); //"http://localhost:1881";

    constructor(private http: HttpClient,
        private toastr: ToastrService) {

        if (environment.serverEnabled) {
            this.checkServer().subscribe(result => {
                this.serverSettings = result;
                this.load();
                // this.toastr.success('Server connected!');
            }, error => {
                this.load();
                console.error(error);
                this.toastr.error('Server connection failed!', '', {
                    timeOut: 3000,
                    closeButton: true,
                    disableTimeOut: true
                });
            });
        } else {
            this.load();
        }
    }

    load() {
        console.log('load Project');

        if (this.serverSettings) {
            this.getServerProject().subscribe(prj => {
                this.projectData = prj;
                this.notifyToLoadHmi();
                console.log(prj);
            }, err => {
                console.log(err);
            });
        } else {
            if (!this.projectData) {
                let res = localStorage.getItem(this.prjresource);
                if (res) {
                    this.projectData = JSON.parse(res);
                } else if (environment.demo) {
                    // load demo from server
                    this.getDemoProject().subscribe(prj => {
                        this.projectData = prj;
                    }, err => {
                        console.log(err);
                    });
                } else {
                    this.projectData = new ProjectData();
                    let server = new Device();
                    server.name = 'Fuxa Server';
                    server.id = '0';
                    server.type = DeviceType.FuxaServer;
                    server.property = new DeviceNetProperty();
                    this.setServer(server);
                }
            }
        }
    }

    save(): boolean {
        console.log('-save-');
        this.projectData.version = this.version;
        let prjData = this.convertToSave(this.projectData);
        if (this.serverSettings) {
            this.setServerProject(prjData).subscribe(result => {
                console.log(result);
                // this.toastr.success('Project save successful!');
            }, err => {
                console.log(err);
                this.toastr.error('Project save failed', '', {
                    timeOut: 3000,
                    closeButton: true,
                    disableTimeOut: true
                });
            });
        } else {
            localStorage.setItem(this.prjresource, JSON.stringify(prjData));
        }
        return true;
    }

    saveAs() {
        let filename = 'MyProject.fuxap';
        let date = new Date();
        let content = JSON.stringify(this.convertToSave(this.getProject()));
        let blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        FileSaver.saveAs(blob, filename);
    }

    /**
     * Remove Tag value to save without value
     * Value was added by HmiService from socketIo event
     * @param prj
     */
    private convertToSave(prj: ProjectData) {
        let result = JSON.parse(JSON.stringify(prj));
        for (let devid in result.devices) {
            for (let tagid in result.devices[devid].tags) {
                delete result.devices[devid].tags[tagid].value;
            }
            // Object.values(result.devices[devid].tags).forEach(tag => {
                // delete tag.value;

                // if (val[domViewId]) {
                //   delete val[domViewId];
                // }
            // });
            // for (let tag in Object.values(result.devices[devid].tags)) {
                // delete tag.value;
            // };
        }
        return result;
    }

    //#region to server api
    getServerProject(): Observable<any> {
        return this.http.get<any>(this.endPointConfig + '/api/project', {});
    }

    setServerProject(prj: ProjectData) {
        // let header = new HttpHeaders();
        // header.append("Access-Control-Allow-Origin", "*");
        // header.append("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        let header = new HttpHeaders({ 'Content-Type': 'application/json' });
        return this.http.post<ProjectData>(this.endPointConfig + '/api/project', prj, { headers: header });
    }
    //#endregion

    //#region hmi resource json struct
    /**
     * get hmiresource
     */
    getHmi() {
        return (this.projectData) ? this.projectData.hmi : null;
    }

    /**
     * save hmi resource to backend
     * @param hmi hmiresource to save
     */
    setHmi(hmi: Hmi, notify?: boolean) {
        this.projectData.hmi = hmi;
        if (notify) {
            this.notifyToLoadHmi();
        }
    }
    //#endregion

    //#region Notify

    notifyToLoadHmi() {
        this.onLoadHmi.emit(true);
    }
    //#endregion

    /**
     * set Project data andf save resource to backend
     * @param prj project data to save
     */
    setProject(prj: ProjectData, notify?: boolean) {
        // redefine variable list and device list throw views resurce used
        prj.version = this.version;
        // hmi.views.forEach(view => {
        //     for (let key in view.items) {
        //         // variable
        //         if (view.items[key].property.variableSrc && view.items[key].property.variable) {
        //             let device = hmi.devices[view.items[key].property.variableSrc];
        //             if (!device) {
        //                 device = new Device();
        //                 device.name = view.items[key].property.variableSrc;
        //                 // search in project
        //                 if (devices) {
        //                     let prjdevice = devices[view.items[key].property.variableSrc];
        //                     if (prjdevice) {
        //                         device = JSON.parse(JSON.stringify(prjdevice));
        //                         device.tags = {};
        //                     }
        //                 }
        //                 hmi.devices[view.items[key].property.variableSrc] = device;
        //             }
        //             // let tag = 
        //         }
        //         // alarm
        //     }
        // });
        // console.log('set-prj: ' + JSON.stringify(prj));
        this.projectData = prj;
        this.save();
        if (notify) {
            this.notifyToLoadHmi();
        }
    }

    setNewProject() {
        this.projectData = new ProjectData();
        let server = new Device();
        server.name = 'Fuxa Server';
        server.id = '0';
        server.type = DeviceType.FuxaServer;
        server.property = new DeviceNetProperty();
        this.setServer(server);
        this.notifyToLoadHmi();
    }

    getProject() {
        return this.projectData;
    }

    getServer(): Device {
        return (this.projectData) ? this.projectData.server : null;
    }

    setServer(srv: Device, nosave?: boolean): boolean {
        this.projectData.server = srv;
        if (nosave) {
            return true;
        }
        return this.save();
    }

    getDevices(): any {
        return (this.projectData) ? this.projectData.devices : {};
    }

    setDevices(devices: any, nosave?: boolean): boolean {
        this.projectData.devices = devices;
        if (nosave) {
            return true;
        }
        return this.save();
    }

    addDevice(d: Device): boolean {
        let dev = this.projectData.devices[d.name];
        if (dev) {
            this.projectData.devices[d.name];
            return this.save();
        }
        return false;
    }

    saveProject(saveas?: boolean) {
        this.onSaveCurrent.emit(saveas);
    }

    checkServer() {
        return this.http.get<any>(this.endPointConfig + '/api/settings');
    }

    getDemoProject() {
        return this.http.get<any>(this.endPointConfig + '/api/projectdemo');
    }
}

export class ProjectData {
    version: string = "1.00"
    projectFile: string;
    server: Device = new Device();
    hmi: Hmi = new Hmi();
    devices = {};
}