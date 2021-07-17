
import { Injectable, Output, EventEmitter } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

import { EndPointApi } from '../../_helpers/endpointapi';
import { ProjectData, ProjectDataCmdType } from '../../_models/project';
import { ResourceStorageService } from './resource-storage.service';

@Injectable()
export class ResWebApiService implements ResourceStorageService {

    private endPointConfig: string = EndPointApi.getURL();
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
        return this.http.get<any>(this.endPointConfig + '/api/project', {});
    }

    setServerProject(prj: ProjectData) {
        // let header = new HttpHeaders();
        // header.append("Access-Control-Allow-Origin", "*");
        // header.append("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        let header = new HttpHeaders({ 'Content-Type': 'application/json' });
        return this.http.post<ProjectData>(this.endPointConfig + '/api/project', prj, { headers: header });
    }

    setServerProjectData(cmd: ProjectDataCmdType, data: any) {
        let header = new HttpHeaders({ 'Content-Type': 'application/json' });
        let params = { cmd: cmd, data: data };
        return this.http.post<any>(this.endPointConfig + '/api/projectData', params, { headers: header });
    }
    
    getDeviceSecurity(id: string): Observable<any> {
        let header = new HttpHeaders({ 'Content-Type': 'application/json' });
        let params = { query: 'security', name: id };
        return this.http.get<any>(this.endPointConfig + '/api/device', { headers: header, params: params });
    }

    setDeviceSecurity(id: string, value: string): Observable<any> {
        let header = new HttpHeaders({ 'Content-Type': 'application/json' });
        let params = { query: 'security', name: id, value: value };
        return this.http.post<any>(this.endPointConfig + '/api/device', { headers: header, params: params });
    }

    getAlarmsValues(): Observable<any> {
        return this.http.get<any>(this.endPointConfig + '/api/alarms', {});
    }
    
    setAlarmAck(name: string): Observable<any> {
        return new Observable((observer) => {
            let header = new HttpHeaders({ 'Content-Type': 'application/json' });
            this.http.post<any>(this.endPointConfig + '/api/alarmack', { headers: header, params: name }).subscribe(result => {
                observer.next();
            }, err => {
                observer.error(err);
            });                
        });
    }

    checkServer(): Observable<any> {
        return this.http.get<any>(this.endPointConfig + '/api/settings');
    }

    getAppId() {
        return ResourceStorageService.prjresource;
    }
}