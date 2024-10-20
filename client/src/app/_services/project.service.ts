
import { Injectable, Output, EventEmitter } from '@angular/core';
import { Observable, Subject, firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import { ProjectData, ProjectDataCmdType, UploadFile } from '../_models/project';
import { View, LayoutSettings, DaqQuery } from '../_models/hmi';
import { Chart } from '../_models/chart';
import { Graph } from '../_models/graph';
import { Alarm, AlarmBaseType, AlarmQuery, AlarmsFilter } from '../_models/alarm';
import { Notification } from '../_models/notification';
import { Script } from '../_models/script';
import { Text } from '../_models/text';
import { Device, DeviceType, DeviceNetProperty, DEVICE_PREFIX, DevicesUtils, Tag, FuxaServer, TagSystemType, TAG_PREFIX, ServerTagType, TagDevice } from '../_models/device';
import { ToastrService } from 'ngx-toastr';
import { TranslateService } from '@ngx-translate/core';
import { ResourceStorageService } from './rcgi/resource-storage.service';
import { ResDemoService } from './rcgi/resdemo.service';
import { ResClientService } from './rcgi/resclient.service';
import { ResWebApiService } from './rcgi/reswebapi.service';
import { AppService } from './app.service';
import { Utils } from '../_helpers/utils';

import * as FileSaver from 'file-saver';
import { Report } from '../_models/report';

@Injectable()
export class ProjectService {

    @Output() onSaveCurrent: EventEmitter<SaveMode> = new EventEmitter();
    @Output() onLoadHmi: EventEmitter<boolean> = new EventEmitter();

    private projectData = new ProjectData();            // Project data
    public AppId = '';

    public serverSettings: ServerSettings;
    private storage: ResourceStorageService;

    private projectOld = '';
    private ready = false;

    constructor(private resewbApiService: ResWebApiService,
        private resDemoService: ResDemoService,
        private resClientService: ResClientService,
        private appService: AppService,
        private translateService: TranslateService,
        private toastr: ToastrService) {

        this.storage = resewbApiService;
        if (!environment.serverEnabled || appService.isDemoApp) {
            this.storage = resDemoService;
        } else if (appService.isClientApp) {
            this.storage = resClientService;
        }
        // console.log("mode:", environment.type);
        this.storage.getAppId = () => this.getAppId();
        this.storage.onRefreshProject = (): boolean => this.onRefreshProject();
        this.storage.checkServer().subscribe(result => {
            if (!environment.serverEnabled || result) {
                this.serverSettings = result;
                this.load();
            }
        }, error => {
            console.error('project.service err: ' + error);
            this.load();
            this.notifyServerError();
        });
    }

    getAppId() {
        return this.AppId;
    }

    init(bridge?: any) {
        this.storage.init(bridge);
        if (this.appService.isClientApp) {
        }
        this.reload();
    }

    onRefreshProject(): boolean {
        this.storage.getStorageProject().subscribe(prj => {
            if (prj) {
                this.projectData = prj;
                // copy to check before save
                this.projectOld = JSON.parse(JSON.stringify(this.projectData));
                this.ready = true;
                this.notifyToLoadHmi();
            } else {
                let msg = '';
                this.translateService.get('msg.get-project-void').subscribe((txt: string) => { msg = txt; });
                console.warn(msg);
                // this.notifySaveError(msg);
            }
        }, err => {
            console.error('FUXA onRefreshProject error', err);
        });
        return true;
    }

    //#region Load and Save
    /**
     * Load Project from Server if enable.
     * From Local Storage, from 'assets' if demo or create a local project
     */
    private load() {
        this.storage.getStorageProject().subscribe(prj => {
            if (!prj && this.appService.isDemoApp) {
                console.log('create demo');
                this.setNewProject();
            } else if (this.appService.isClientApp) {
                if (!prj && (this.storage as ResClientService).isReady) {
                    this.setNewProject();
                } else {
                    this.projectData = prj;
                }
                this.ready = true;
                this.notifyToLoadHmi();
            } else {
                this.projectData = prj;
                // copy to check before save
                this.projectOld = JSON.parse(JSON.stringify(this.projectData));
                this.ready = true;
                this.notifyToLoadHmi();
            }
        }, err => {
            console.error('FUXA load error', err);
        });
    }

    /**
     * Save Project
     */
    save(skipNotification = false): Subject<boolean> {
        // check project change don't work some svg object change the order and this to check isn't easy...boooo
        const subject = new Subject<boolean>();
        this.storage.setServerProject(this.projectData).subscribe(result => {
            this.load();
            if (!skipNotification) {
                this.notifySuccessMessage('msg.project-save-success');
            }
            subject.next(true);
        }, err => {
            console.error(err);
            var msg = '';
            this.translateService.get('msg.project-save-error').subscribe((txt: string) => { msg = txt; });
            this.toastr.error(msg, '', {
                timeOut: 3000,
                closeButton: true,
                disableTimeOut: true
            });
            subject.next(false);
        });
        return subject;
    }

    saveAs() {
        let filename = 'fuxa-project.json';
        if (this.getProjectName()) {
            filename = `${this.getProjectName()}.json`;
        }
        let content = JSON.stringify(this.convertToSave(this.getProject()));
        let blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        FileSaver.saveAs(blob, filename);
    }

    exportDevices(type: string) {
        let content = '';
        const name = this.projectData.name || 'fuxa';
        let filename = `${name}-devices.${type}`;
        const devices = <Device[]>Object.values(this.convertToSave(this.getDevices()));
        if (type === 'csv') {
            content = DevicesUtils.devicesToCsv(devices);
        } else {    // json
            if (this.getProjectName()) {
                filename = `${this.getProjectName()}-devices.json`;
            }
            content = JSON.stringify(devices, null, 2);
        }
        let blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        FileSaver.saveAs(blob, filename);
    }

    importDevices(devices: Device[]) {
        if (!devices) {
            this.notifyError('msg.import-devices-error');
        } else {
            devices.forEach(device => {
                if (device.id && device.name) {
                    this.setDevice(device, null, null);
                }
            });
        }
    }

    reload() {
        this.load();
    }

    /**
     * Remove Tag value to save without value
     * Value was added by HmiService from socketIo event
     * @param prj
     */
    private convertToSave(prj: ProjectData) {
        let result = JSON.parse(JSON.stringify(prj));
        if (this.appService.isClientApp) {
            let sprj = ResourceStorageService.sanitizeProject(prj);
            result = JSON.parse(JSON.stringify(sprj));
        }
        for (let devid in result.devices) {
            for (let tagid in result.devices[devid].tags) {
                delete result.devices[devid].tags[tagid].value;
            }
        }
        return result;
    }

    getProjectName(): string {
        return (this.projectData) ? this.projectData.name : null;
    }

    setProjectName(name: string) {
        this.projectData.name = name;
        this.save();
    }
    //#endregion

    //#region Device to Save
    /**
     * Add or update Device to Project.
     * Save to Server
     * @param device
     * @param old
     */
    setDevice(device: Device, old: Device, security?: any) {
        if (this.projectData.devices) {
            this.projectData.devices[device.id] = device;
            this.storage.setDeviceSecurity(device.id, security).subscribe(() => {
                this.storage.setServerProjectData(ProjectDataCmdType.SetDevice, device, this.projectData).subscribe(result => {
                    if (old && old.id !== device.id) {
                        this.removeDevice(old);
                    }
                }, err => {
                    console.error(err);
                    this.notifySaveError(err);
                });
            }, err => {
                console.error(err);
                this.notifySaveError(err);
            });
        }
    }

    setDeviceTags(device: Device) {
        this.projectData.devices[device.id] = device;
        this.storage.setServerProjectData(ProjectDataCmdType.SetDevice, device, this.projectData).subscribe(result => {
        }, err => {
            console.error(err);
            this.notifySaveError(err);
        });
    }

    /**
     * Remove Device from Project.
     * Save to Server
     * @param device
     */
    removeDevice(device: Device) {
        delete this.projectData.devices[device.id];
        this.storage.setServerProjectData(ProjectDataCmdType.DelDevice, device, this.projectData).subscribe(result => {
        }, err => {
            console.error(err);
            this.notifySaveError(err);
        });
        this.storage.setDeviceSecurity(device.id, '').subscribe(() => {
        }, err => {
            console.error(err);
            this.notifySaveError(err);
        });
    }

    getDeviceSecurity(id: string): Observable<any> {
        return this.storage.getDeviceSecurity(id);
    }
    //#endregion

    //#region View to Save
    /**
     * Add or update View to Project.
     * Save to Server
     * @param view
     */
    setView(view: View, notify = false) {
        let v = null;
        for (let i = 0; i < this.projectData.hmi.views.length; i++) {
            if (this.projectData.hmi.views[i].id === view.id) {
                v = this.projectData.hmi.views[i];
            }
        }
        if (v) {
            v = view;
        } else {
            this.projectData.hmi.views.push(view);
        }
        this.storage.setServerProjectData(ProjectDataCmdType.SetView, view, this.projectData).subscribe(result => {
            if (notify) {
                this.notifySuccessMessage('msg.project-save-success');
            }
        }, err => {
            console.error(err);
            this.notifySaveError(err);
        });
    }

    /**
     *
     * @returns
     */
    getViews(): View[] {
        return (this.projectData) ? this.projectData.hmi.views : [];
    }


    getViewId(name: string) {
        let views = this.getViews();
        for (var i = 0; i < views.length; i++) {
            if (views[i].name === name) {
                return views[i].id;
            }
        }
        return null;
    }

    getViewFromId(id: string) {
        let views = this.getViews();
        for (var i = 0; i < views.length; i++) {
            if (views[i].id === id) {
                return views[i];
            }
        }
        return null;
    }

    /**
     * Remove the View from Project
     * Delete from Server
     * @param view
     */
    removeView(view: View) {
        for (let i = 0; i < this.projectData.hmi.views.length; i++) {
            if (this.projectData.hmi.views[i].id === view.id) {
                this.projectData.hmi.views.splice(i, 1);
                break;
            }
        }
        this.storage.setServerProjectData(ProjectDataCmdType.DelView, view, this.projectData).subscribe(result => {
        }, err => {
            console.error(err);
            this.notifySaveError(err);
        });
    }
    //#endregion

    //#region Hmi, Layout resource json struct

    /**
     * get hmi resource
     */
    getHmi() {
        return (this.ready && this.projectData) ? this.projectData.hmi : null;
    }

    setLayout(layout: LayoutSettings) {
        this.projectData.hmi.layout = layout;
        this.saveLayout();
    }


    setLayoutTheme(theme: string) {
        this.projectData.hmi.layout.theme = theme;
        this.saveLayout();
    }

    getLayoutTheme() {
        if (this.projectData.hmi.layout) {
            return this.projectData.hmi.layout.theme;
        }
        return null;
    }

    saveLayout() {
        this.storage.setServerProjectData(ProjectDataCmdType.HmiLayout, this.projectData.hmi.layout, this.projectData).subscribe(result => {
        }, err => {
            console.error(err);
            this.notifySaveError(err);
        });
    }
    //#endregion

    //#region Charts resource
    /**
     * get charts resource
     */
    getCharts() {
        return (this.projectData) ? (this.projectData.charts) ? this.projectData.charts : [] : null;
    }

    getChart(id: string) {
        for (let i = 0; i < this.projectData.charts.length; i++) {
            if (this.projectData.charts[i].id === id) {
                return this.projectData.charts[i];
            }
        }
    }

    /**
     * save the charts to project
     * @param charts
     */
    setCharts(charts: Chart[]) {
        this.projectData.charts = charts;
        this.storage.setServerProjectData(ProjectDataCmdType.Charts, charts, this.projectData).subscribe(result => {
        }, err => {
            console.error(err);
            this.notifySaveError(err);
        });
    }
    //#endregion

    //#region Graph resource
    /**
     * get graphs list
     * @returns
     */
    getGraphs(): Graph[] {
        return (this.projectData) ? (this.projectData.graphs) ? this.projectData.graphs : [] : null;
    }

    /**
     * get the graph of id
     * @param id
     * @returns
     */
    getGraph(id: string) {
        if (this.projectData.graphs) {
            for (let i = 0; i < this.projectData.graphs.length; i++) {
                if (this.projectData.graphs[i].id === id) {
                    return this.projectData.graphs[i];
                }
            }
        }
        return null;
    }

    /**
     * save the graphs to project
     * @param graphs
     */
    setGraphs(graphs: Graph[]) {
        this.projectData.graphs = graphs;
        this.storage.setServerProjectData(ProjectDataCmdType.Graphs, graphs, this.projectData).subscribe(result => {
        }, err => {
            console.error(err);
            this.notifySaveError(err);
        });
    }
    //#endregion

    //#region Alarms resource
    /**
     * get alarms resource
     */
    getAlarms() {
        return (this.projectData) ? (this.projectData.alarms) ? this.projectData.alarms : [] : null;
    }

    /**
     * save the alarm to project
     */
    setAlarm(alarm: Alarm, old: Alarm) {
        return new Observable((observer) => {
            if (!this.projectData.alarms) {
                this.projectData.alarms = [];
            }
            let exist = this.projectData.alarms.find(tx => tx.name === alarm.name);
            if (exist) {
                exist.property = alarm.property;
                exist.highhigh = alarm.highhigh;
                exist.high = alarm.high;
                exist.low = alarm.low;
                exist.info = alarm.info;
                exist.actions = alarm.actions;
                exist.value = alarm.value;
            } else {
                this.projectData.alarms.push(alarm);
            }
            this.storage.setServerProjectData(ProjectDataCmdType.SetAlarm, alarm, this.projectData).subscribe(result => {
                if (old && old.name && old.name !== alarm.name) {
                    this.removeAlarm(old).subscribe(result => {
                        observer.next();
                    });
                } else {
                    observer.next();
                }
            }, err => {
                console.error(err);
                this.notifySaveError(err);
                observer.error(err);
            });
        });
    }

    /**
     * remove the alarm from project
     */
    removeAlarm(alarm: Alarm) {
        return new Observable((observer) => {
            if (this.projectData.alarms) {
                for (let i = 0; i < this.projectData.alarms.length; i++) {
                    if (this.projectData.alarms[i].name === alarm.name) {
                        this.projectData.alarms.splice(i, 1);
                        break;
                    }
                }
            }
            this.storage.setServerProjectData(ProjectDataCmdType.DelAlarm, alarm, this.projectData).subscribe(result => {
                observer.next();
            }, err => {
                console.error(err);
                this.notifySaveError(err);
                observer.error(err);
            });
        });
    }

    getAlarmsValues(alarmFilter?: AlarmsFilter): Observable<AlarmBaseType[]> {
        return this.storage.getAlarmsValues(alarmFilter);
    }

    getAlarmsHistory(query: AlarmQuery): Observable<any> {
        return this.storage.getAlarmsHistory(query);
    }

    setAlarmAck(name: string): Observable<any> {
        return this.storage.setAlarmAck(name);
    }
    //#endregion

    //#region Notifications resource
    /**
     * get notifications resource
     */
    getNotifications() {
        return (this.projectData) ? (this.projectData.notifications) ? this.projectData.notifications : [] : null;
    }

    /**
     * save the notification to project
     */
    setNotification(notification: Notification, old: Notification) {
        return new Observable((observer) => {
            if (!this.projectData.notifications) {
                this.projectData.notifications = [];
            }
            let exist = this.projectData.notifications.find(tx => tx.id === notification.id);
            if (exist) {
                exist.name = notification.name;
                exist.delay = notification.delay;
                exist.interval = notification.interval;
                exist.options = notification.options;
                exist.receiver = notification.receiver;
                exist.enabled = notification.enabled;
                exist.subscriptions = notification.subscriptions;
                exist.text = notification.text;
                exist.type = notification.type;
            } else {
                this.projectData.notifications.push(notification);
            }
            this.storage.setServerProjectData(ProjectDataCmdType.SetNotification, notification, this.projectData).subscribe(result => {
                if (old && old.id && old.id !== notification.id) {
                    this.removeNotification(old).subscribe(result => {
                        observer.next();
                    });
                } else {
                    observer.next();
                }
            }, err => {
                console.error(err);
                this.notifySaveError(err);
                observer.error(err);
            });
        });
    }

    /**
     * remove the notification from project
     */
    removeNotification(notification: Notification) {
        return new Observable((observer) => {
            if (this.projectData.notifications) {
                for (let i = 0; i < this.projectData.notifications.length; i++) {
                    if (this.projectData.notifications[i].id === notification.id) {
                        this.projectData.notifications.splice(i, 1);
                        break;
                    }
                }
            }
            this.storage.setServerProjectData(ProjectDataCmdType.DelNotification, notification, this.projectData).subscribe(result => {
                observer.next();
            }, err => {
                console.error(err);
                this.notifySaveError(err);
                observer.error(err);
            });
        });
    }
    //#endregion

    //#region Scripts resource
    /**
     * get scripts
     */
    getScripts(): Script[] {
        return (this.projectData) ? (this.projectData.scripts) ? this.projectData.scripts : [] : null;
    }

    /**
     * save the script to project
     */
    setScript(script: Script, old: Script) {
        return new Observable((observer) => {
            if (!this.projectData.scripts) {
                this.projectData.scripts = [];
            }
            let exist = this.projectData.scripts.find(tx => tx.id === script.id);
            if (exist) {
                exist.name = script.name;
                exist.code = script.code;
                exist.parameters = script.parameters;
                exist.mode = script.mode;
            } else {
                this.projectData.scripts.push(script);
            }
            this.storage.setServerProjectData(ProjectDataCmdType.SetScript, script, this.projectData).subscribe(result => {
                if (old && old.id && old.id !== script.id) {
                    this.removeScript(old).subscribe(result => {
                        observer.next();
                    });
                } else {
                    observer.next();
                }
            }, err => {
                console.error(err);
                this.notifySaveError(err);
                observer.error(err);
            });
        });
    }

    /**
     * remove the script from project
     */
    removeScript(script: Script) {
        return new Observable((observer) => {
            if (this.projectData.scripts) {
                for (let i = 0; i < this.projectData.scripts.length; i++) {
                    if (this.projectData.scripts[i].id === script.id) {
                        this.projectData.scripts.splice(i, 1);
                        break;
                    }
                }
            }
            this.storage.setServerProjectData(ProjectDataCmdType.DelScript, script, this.projectData).subscribe(result => {
                observer.next();
            }, err => {
                console.error(err);
                this.notifySaveError(err);
                observer.error(err);
            });
        });
    }
    //#endregion

    //#region Reports
    /**
     * get reports
     */
    getReports(): Report[] {
        return (this.projectData) ? (this.projectData.reports) ? this.projectData.reports : [] : null;
    }

    /**
     * save the report to project
     */
    setReport(report: Report, old: Report) {
        return new Observable((observer) => {
            if (!this.projectData.reports) {
                this.projectData.reports = [];
            }
            let exist = this.projectData.reports.find(tx => tx.id === report.id);
            if (exist) {
                Utils.assign(exist, report);
            } else {
                this.projectData.reports.push(report);
            }
            this.storage.setServerProjectData(ProjectDataCmdType.SetReport, report, this.projectData).subscribe(result => {
                if (old && old.id && old.id !== report.id) {
                    this.removeReport(old).subscribe(result => {
                        observer.next();
                    });
                } else {
                    observer.next();
                }
            }, err => {
                console.error(err);
                this.notifySaveError(err);
                observer.error(err);
            });
        });
    }

    /**
     * remove the report from project
     */
     removeReport(report: Report) {
        return new Observable((observer) => {
            if (this.projectData.reports) {
                for (let i = 0; i < this.projectData.reports.length; i++) {
                    if (this.projectData.reports[i].id === report.id) {
                        this.projectData.reports.splice(i, 1);
                        break;
                    }
                }
            }
            this.storage.setServerProjectData(ProjectDataCmdType.DelReport, report, this.projectData).subscribe(result => {
                observer.next();
            }, err => {
                console.error(err);
                this.notifySaveError(err);
                observer.error(err);
            });
        });
    }
    //#endregion

    //#region Texts resource
    /**
     * get texts resource
     */
    getTexts() {
        return (this.projectData) ? (this.projectData.texts) ? this.projectData.texts : [] : null;
    }

    /**
     * save the text to project
     * @param text
     */
    setText(text: Text, old: Text) {
        if (!this.projectData.texts) {
            this.projectData.texts = [];
        }
        let exist = this.projectData.texts.find(tx => tx.name === text.name);
        if (exist) {
            exist.group = text.group;
            exist.value = text.value;
        } else {
            this.projectData.texts.push(text);
        }
        this.storage.setServerProjectData(ProjectDataCmdType.SetText, text, this.projectData).subscribe(result => {
            if (old && old.name && old.name !== text.name) {
                this.removeText(old);
            }
        }, err => {
            console.error(err);
            this.notifySaveError(err);
        });
    }

    /**
     * remove the text from project
     * @param text
     */
    removeText(text: Text) {
        if (this.projectData.texts) {
            for (let i = 0; i < this.projectData.texts.length; i++) {
                if (this.projectData.texts[i].name === text.name) {
                    this.projectData.texts.splice(i, 1);
                    break;
                }
            }
        }
        this.storage.setServerProjectData(ProjectDataCmdType.DelText, text, this.projectData).subscribe(result => {
        }, err => {
            console.error(err);
            this.notifySaveError(err);
        });
    }
    //#endregion

    //#region Notify

    public notifyToLoadHmi() {
        this.onLoadHmi.emit(true);
    }

    private notifySaveError(err: any) {
        console.error('FUXA notifySaveError error', err);
        let msg = null;
        this.translateService.get('msg.project-save-error').subscribe((txt: string) => { msg = txt; });
        if (err.status === 401) {
            this.translateService.get('msg.project-save-unauthorized').subscribe((txt: string) => { msg = txt; });
        }
        if (msg) {
            this.toastr.error(msg, '', {
                timeOut: 3000,
                closeButton: true,
                disableTimeOut: true
            });
        }
    }

    private notifyServerError() {
        console.error('FUXA notifyServerError error');
        let msg = null;
        this.translateService.get('msg.server-connection-error').subscribe((txt: string) => { msg = txt; });
        if (msg) {
            this.toastr.error(msg, '', {
                timeOut: 3000,
                closeButton: true,
                disableTimeOut: true
            });
        }
    }

    private notifyError(msgCode: string) {
        this.translateService.get(msgCode).subscribe((txt: string) => { msgCode = txt; });
        if (msgCode) {
            console.error(`FUXA Error: ${msgCode}`);
            this.toastr.error(msgCode, '', {
                timeOut: 3000,
                closeButton: true,
                disableTimeOut: true
            });
        }
    }
    //#endregion

    //#region Upload resource to server
    uploadFile(file: any): Observable<UploadFile> {
        return this.storage.uploadFile(file);
    }
    //#endregion

    //#region DAQ query
    getDaqValues(query: DaqQuery): Observable<any> {
        return this.storage.getDaqValues(query);
    }
    //#endregion

    async getTagsValues(tagsIds: string[]): Promise<any[]> {
        let values = await firstValueFrom(this.storage.getTagsValues(tagsIds));
        return values;
    }

    async runSysFunctionSync(functionName: string, params: any): Promise<any> {
        let values = await firstValueFrom(this.storage.runSysFunction(functionName, params));
        return values;
    }

    /**
     * Set Project data and save resource to backend
     * Used from open and upload JSON Project file
     * @param prj project data to save
     */
    setProject(prj: ProjectData, skipNotification = false) {
        this.projectData = prj;
        if (this.appService.isClientApp) {
            this.projectData = ResourceStorageService.defileProject(prj);
        }
        this.save(skipNotification);
    }

    setNewProject() {
        this.projectData = new ProjectData();
        let server = new Device(Utils.getGUID(DEVICE_PREFIX));
        server.name = FuxaServer.name;
        server.id = FuxaServer.id;
        server.type = DeviceType.FuxaServer;
        server.enabled = true;
        server.property = new DeviceNetProperty();
        if (!this.appService.isClientApp) {
            this.projectData.server = server;
        } else {
            delete this.projectData.server;
        }
        this.save(true);
    }

    getProject() {
        return this.projectData;
    }

    checkServer() {
        return this.storage.checkServer();
    }

    getServer(): Device {
        return (this.projectData) ? this.projectData.server : null;
    }

    getServerDevices(): Device[] {
        return <Device[]>Object.values(this.getDevices()).filter((device: Device) => device.type !== DeviceType.internal);
    }

    getDevices(): any {
        let result = {};
        if (this.projectData) {
            result = this.projectData.devices;
            if (!result[this.projectData.server.id]) {
                // add server as device to use in script and logic
                let server: Device = JSON.parse(JSON.stringify(this.projectData.server));
                server.enabled = true;
                server.tags = {};
                result[server.id] = server;
            }
        }
        return result;
    }

    getDeviceFromId(id: string): any {
        let result;
        Object.keys(this.projectData.devices).forEach(k => {
            if (this.projectData.devices[k].id === id) {
                result = this.projectData.devices[k];
            }
        });
        return result;
    }

    getDeviceFromTagId(tagId: string): Device {
        let devices = <Device[]>Object.values(this.projectData.devices);
        for (let i = 0; i < devices.length; i++) {
            if (devices[i].tags[tagId]) {
                return devices[i];
            }
        }
    }

    getTagFromId(tagId: string, withDeviceRef?: boolean): Tag | TagDevice {
        let devices = <Device[]>Object.values(this.projectData.devices);
        for (let i = 0; i < devices.length; i++) {
            if (devices[i].tags[tagId]) {
                const tag = devices[i].tags[tagId];
                if (withDeviceRef) {
                    let tagDevice = <TagDevice>Utils.clone(tag);
                    tagDevice.deviceId = devices[i].id;
                    tagDevice.deviceName = devices[i].name;
                    tagDevice.deviceType = devices[i].type;
                    return tagDevice;
                }
                return devices[i].tags[tagId];
            }
        }
        return null;
    }

    getTagIdFromName(tagName: string, deviceName?: string): string {
        let devices = <Device[]>Object.values(this.projectData.devices);
        for (let i = 0; i < devices.length; i++) {
            if (!deviceName || devices[i].name === deviceName) {
                let result = <Tag>Object.values(devices[i].tags).find((tag: Tag) => tag.name === tagName);
                if (result) {
                    return result.id;
                }
            }
        }
        return null;
    }

    /**
     * Check to add or remove system Tags, example connection status to add in device FUXA server
     */
    checkSystemTags() {
        let devices = Object.values(this.projectData.devices).filter((device: Device) => device.id !== FuxaServer.id);
        let fuxaServer = <Device>this.projectData.devices[FuxaServer.id];
        if (fuxaServer) {
            devices.forEach((device: Device) => {
                if (!Object.values(fuxaServer.tags).find((tag: Tag) => tag.sysType === TagSystemType.deviceConnectionStatus && tag.memaddress === device.id)) {
                    let tag = new Tag(Utils.getGUID(TAG_PREFIX));
                    tag.name = device.name + ' Connection Status';
                    tag.label = device.name + ' Connection Status';
                    tag.type = ServerTagType.number;
                    tag.memaddress = device.id;
                    tag.sysType = TagSystemType.deviceConnectionStatus;
                    tag.init = tag.value = '';
                    fuxaServer.tags[tag.id] = tag;
                }
            });
            this.setDeviceTags(fuxaServer);
        }
        return this.getDevices();
    }

    /**
     * Send Save Project to to editor component
     * @param saveas
     */
    saveProject(mode = SaveMode.Save) {
        this.onSaveCurrent.emit(mode);
    }

    isSecurityEnabled() {
        if (environment.serverEnabled) {
            if (this.serverSettings && !this.serverSettings.secureEnabled) {
                return false;
            }
            return true;
        } else {
            return false;
        }

    }

    private _deepEquals(x, y) {
        if (JSON.stringify(x) === JSON.stringify(y)) {
            return true; // if both x and y are null or undefined and exactly the same

        } else {
            try {
                for (const p in x) {
                    if (!x.hasOwnProperty(p)) {
                        continue; // other properties were tested using x.constructor === y.constructor
                    }
                    if (!y.hasOwnProperty(p)) {
                        return false; // allows to compare x[ p ] and y[ p ] when set to undefined
                    }
                    if (p === 'svgcontent') {
                        // the xml have to be transform in json
                        const parser = new DOMParser();  // initialize dom parser
                        const aDOM = parser.parseFromString(x[p], 'text/xml');
                        const bDOM = parser.parseFromString(y[p], 'text/xml');
                        let a = this._xml2json(aDOM);
                        let b = this._xml2json(bDOM);
                        return this._deepEquals(a, b);
                    }
                    if (x[p] === y[p]) {
                        continue; // if they have the same strict value or identity then they are equal
                    }
                    if (!this._deepEquals(x[p], y[p])) {
                        return false;
                    }
                }
                for (const p in y) {
                    if (y.hasOwnProperty(p) && !x.hasOwnProperty(p)) {
                        return false;
                    }
                }
            } catch (ex) {
                console.error(ex);
                return false;
            }
            return true;
        }
    }

    /**
     * This function coverts a DOM Tree into JavaScript Object.
     * @param srcDOM: DOM Tree to be converted.
     */
    private _xml2json(xml) {
        // Create the return object
        var obj = {};

        if (xml.nodeType == 1) { // element
            // do attributes
            if (xml.attributes.length > 0) {
                obj['@attributes'] = {};
                for (var j = 0; j < xml.attributes.length; j++) {
                    var attribute = xml.attributes.item(j);
                    obj['@attributes'][attribute.nodeName] = attribute.nodeValue;
                }
            }
        } else if (xml.nodeType == 3) { // text
            obj = xml.nodeValue;
        }

        // do children
        if (xml.hasChildNodes()) {
            for (var i = 0; i < xml.childNodes.length; i++) {
                var item = xml.childNodes.item(i);
                var nodeName = item.nodeName;
                if (typeof (obj[nodeName]) == 'undefined') {
                    obj[nodeName] = this._xml2json(item);
                } else {
                    if (typeof (obj[nodeName].push) == 'undefined') {
                        var old = obj[nodeName];
                        obj[nodeName] = [];
                        obj[nodeName].push(old);
                    }
                    obj[nodeName].push(this._xml2json(item));
                }
            }
        }
        return obj;
    }

    private notifySuccessMessage(msgKey: string) {
        var msg = '';
        this.translateService.get(msgKey).subscribe((txt: string) => { msg = txt; });
        this.toastr.success(msg);
    }
}

export class ServerSettings {
    version: string;
    secureEnabled: boolean;
}

export enum SaveMode {
    Current,
    Save,
    SaveAs
}
