
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ProjectData, ProjectDataCmdType, UploadFile } from '../../_models/project';
import { ResourceStorageService } from './resource-storage.service';
import { AlarmQuery } from '../../_models/alarm';
import { DaqQuery } from '../../_models/hmi';
import { CommanType } from '../command.service';

@Injectable()
export class ResDemoService implements ResourceStorageService {

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
            observer.next();
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

    getAlarmsValues(): Observable<any> {
        return new Observable((observer) => {
            observer.error('Not supported!');
        });
    }

    getAlarmsHistory(query: AlarmQuery): Observable<any> {
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
}
