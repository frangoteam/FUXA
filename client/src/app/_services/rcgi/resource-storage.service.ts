import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Device } from '../../_models/device';
import { ProjectData, ProjectDataCmdType, UploadFile } from '../../_models/project';
import { AlarmBaseType, AlarmQuery, AlarmsFilter } from '../../_models/alarm';
import { DaqQuery } from '../../_models/hmi';
import { CommanType } from '../command.service';

@Injectable()
export abstract class ResourceStorageService {

    public static prjresource = 'prj-data';

    public abstract init(bridge?: any): boolean;

    public abstract onRefreshProject(): boolean;

    public abstract getDemoProject(): Observable<any>;

    public abstract getStorageProject(): Observable<any>;

    public abstract setServerProject(prj: ProjectData);

    public abstract setServerProjectData(cmd: ProjectDataCmdType, data: any, prj: ProjectData);

    public abstract uploadFile(file: any, destination?: string): Observable<UploadFile>;

    public abstract getDeviceSecurity(id: string): Observable<any>;

    public abstract setDeviceSecurity(id: string, value: string): Observable<any>;

    public abstract getAlarmsValues(alarmFilter?: AlarmsFilter): Observable<AlarmBaseType[]>;

    public abstract getAlarmsHistory(query: AlarmQuery): Observable<AlarmBaseType[]>;

    public abstract setAlarmAck(name: string): Observable<any>;

    public abstract checkServer(): Observable<any>;

    public abstract getAppId(): string;

    public abstract getDaqValues(query: DaqQuery): Observable<any>;

    public abstract heartbeat(activity: boolean): Observable<any>;

    public abstract downloadFile(fileName: string, type: CommanType): Observable<Blob>;

    public abstract endPointConfig: string;

    public abstract getTagsValues(query: string[]): Observable<any>;

    public abstract runSysFunction(functionName: string, params?: any): Observable<any>;

    public static defileProject(source: ProjectData): ProjectData {
        if (!source) {return source;}
        let destination = JSON.parse(JSON.stringify(source));
        let devices = {};
        for (let i = 0; i < destination.devices.length; i++) {
            let tags = {};
            for (let x = 0; x < destination.devices[i].tags.length; x++) {
                tags[destination.devices[i].tags[x].id] = destination.devices[i].tags[x];
            }
            destination.devices[i].tags = tags;
            devices[destination.devices[i].id] = destination.devices[i];
        }
        destination.devices = devices;
        return destination;
    }

    public static sanitizeProject(source: ProjectData): ProjectData {
        let destination = JSON.parse(JSON.stringify(source));
        destination.devices = Object.values(destination.devices);
        for (let i = 0; i < destination.devices.length; i++) {
            destination.devices[i].tags = Object.values(destination.devices[i].tags);
            for (let x = 0; x < destination.devices[i].tags.length; x++) {
                delete destination.devices[i].tags[x].value;
            }
        }
        return destination;
    }

    public static sanitizeDevice(source: Device) {
        let destination = JSON.parse(JSON.stringify(source));
        destination.tags = Object.values(destination.tags);
        return destination;
    }
}
