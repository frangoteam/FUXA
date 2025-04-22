
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
export class ResDemoService implements ResourceStorageService {

    public endPointConfig = '';
    public onRefreshProject: () => boolean;

    constructor(private http: HttpClient) {
    }

    init(): boolean {
        return true;
    }

    getDemoProject(): Observable<any> {
        return this.http.get<any>('./assets/project.demo.fuxap', {});
    }

    getStorageProject(): Observable<any> {
        return new Observable((observer) => {
            let prj = localStorage.getItem(this.getAppId());
            if (prj) {
                observer.next(JSON.parse(prj));
            } else {
                // try root path
                this.getDemoProject().subscribe(demo => {
                    observer.next(demo);
                }, err => {
                    observer.error(err);
                });
            }
        });
    }

    setServerProject(prj: ProjectData) {
        return new Observable((observer) => {
            localStorage.setItem(this.getAppId(), JSON.stringify(prj));
            observer.next(null);
        });
    }

    setServerProjectData(cmd: ProjectDataCmdType, data: any) {
        return new Observable((observer) => {
            observer.next('Not supported!');
        });
    }

    uploadFile(file: any, destination?: string): Observable<UploadFile> {
        return new Observable((observer) => {
            observer.error('Not supported!');
        });
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
            observer.next(null);
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
