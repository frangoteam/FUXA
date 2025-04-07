
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ProjectData, ProjectDataCmdType, UploadFile } from '../../_models/project';
import { ResourceStorageService } from './resource-storage.service';
import { AlarmBaseType, AlarmQuery, AlarmsFilter } from '../../_models/alarm';
import { DaqQuery } from '../../_models/hmi';
import { CommanType } from '../command.service';
import { Report, ReportFile, ReportsQuery } from '../../_models/report';
import { Role } from '../../_models/user';

@Injectable()
export class ResClientService implements ResourceStorageService {

    endPointConfig = '';
    bridge: any = null;
    id: string = null;
    get isReady() { return (this.bridge) ? true : false; }

    public onRefreshProject: () => boolean;

    constructor(private http: HttpClient) {
    }

    init(bridge?: any): boolean {
        this.id = this.getAppId();
        if (!this.bindBridge(bridge)) {
            return false;
        }
        return true;
    }

    private bindBridge(bridge?: any): boolean {
        if (!bridge) {return false;}
        this.bridge = bridge;
        if (this.bridge) {
            this.bridge.onRefreshProject = this.onRefreshProject;
            return true;
        }
        return false;
    }

    getDemoProject(): Observable<any> {
        return this.http.get<any>('./assets/project.demo.fuxap', {});
    }

    getStorageProject(): Observable<any> {
        return new Observable((observer) => {
            if (this.bridge) {
                let sprj = this.bridge.loadProject();
                let prj = ResourceStorageService.defileProject(sprj);
                observer.next(prj);
            } else {
                let prj = localStorage.getItem(this.getAppId());
                if (prj) {
                    observer.next(JSON.parse(prj));
                } else {
                    observer.next();
                }
            }
        });
    }

    setServerProject(prj: ProjectData) {
        return new Observable((observer) => {
            if (!prj) {
                observer.next();
            } else if (this.bridge) {
                let sprj = ResourceStorageService.sanitizeProject(prj);
                if (this.bridge.saveProject(sprj, true)) {
                    observer.next();
                } else {
                    observer.error();
                }
            } else {
                this.saveInLocalStorage(prj);
                observer.next();
            }
        });
    }

    setServerProjectData(cmd: ProjectDataCmdType, data: any, prj: ProjectData) {
        return new Observable((observer) => {
            if (!prj) {
                observer.next();
            } else if (this.bridge) {
                let sprj = ResourceStorageService.sanitizeProject(prj);
                if (this.bridge.saveProject(sprj, false)) {
                    // if (this.isDataCmdForDevice(cmd)) {
                    //     let sdevice = ResourceStorageService.sanitizeDevice(data);
                    //     this.bridge.deviceChange(sdevice);
                    // }
                    observer.next();
                } else {
                    observer.error();
                }
            } else {
                this.saveInLocalStorage(prj);
                observer.next();
            }
        });
    }

    uploadFile(file: any, destination?: string): Observable<UploadFile> {
        return new Observable((observer) => {
            observer.error('Not supported!');
        });
    }

    private isDataCmdForDevice(cmd: ProjectDataCmdType): boolean {
        return (cmd === ProjectDataCmdType.DelDevice || cmd === ProjectDataCmdType.SetDevice);
    }

    saveInLocalStorage(prj: any) {
        if (this.getAppId()) {
            localStorage.setItem(this.getAppId(), JSON.stringify(prj));
        }
    }

    getDeviceSecurity(id: string): Observable<any> {
        return new Observable((observer) => {
            observer.error('Not supported!');
        });
    }

    setDeviceSecurity(name: string, value: string): Observable<any> {
        return new Observable((observer) => {
            observer.next('Not supported!');
        });
    }

    getAlarmsValues(alarmFilter?: AlarmsFilter): Observable<AlarmBaseType[]> {
        return new Observable((observer) => {
            observer.error('Not supported!');
        });
    }

    getAlarmsHistory(query: AlarmQuery): Observable<AlarmBaseType[]> {
        return new Observable((observer) => {
            observer.error('Not supported!');
        });
    }

    setAlarmAck(name: string): Observable<any> {
        return new Observable((observer) => {
            observer.error('Not supported!');
        });
    }

    checkServer(): Observable<any> {
        return new Observable((observer) => {
            observer.next();
        });
    }

    getAppId() {
        return ResourceStorageService.prjresource;
    }

    getDaqValues(query: DaqQuery): Observable<any> {
        return new Observable((observer) => {
            observer.error('Not supported!');
        });
    }

    getTagsValues(query: string[], sourceScriptName?: string): Observable<any> {
        return new Observable((observer) => {
            observer.error('Not supported!');
        });
    }

    runSysFunction(functionName: string, params?: any): Observable<any> {
        return new Observable((observer) => {
            observer.error('Not supported!');
        });
    }

    heartbeat(activity: boolean): Observable<any> {
        return new Observable(observer => {
            observer.error('Not supported!');
        });
    }

    downloadFile(fileName: string, type: CommanType): Observable<Blob> {
        return new Observable(observer => {
            observer.error('Not supported!');
        });
    }

    getReportsDir(report: Report): Observable<string[]> {
        return new Observable(observer => {
            observer.error('Not supported!');
        });
    }

    getReportsQuery(query: ReportsQuery): Observable<ReportFile[]> {
        return new Observable(observer => {
            observer.error('Not supported!');
        });
    }

    getRoles(): Observable<Role[]> {
        return new Observable(observer => {
            observer.error('Not supported!');
        });
    }

    setRoles(roles: Role[]): Observable<any> {
        return new Observable(observer => {
            observer.error('Not supported!');
        });
    }

    removeRoles(roles: Role[]): Observable<any> {
        return new Observable(observer => {
            observer.error('Not supported!');
        });
    }

    buildReport(report: Report): Observable<void> {
        return new Observable(observer => {
            observer.error('Not supported!');
        });
    }

    removeReportFile(fileName: string): Observable<void> {
        return new Observable(observer => {
            observer.error('Not supported!');
        });
    }
}
