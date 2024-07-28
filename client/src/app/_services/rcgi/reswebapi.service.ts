
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { map, Observable, of, switchMap } from 'rxjs';

import { EndPointApi } from '../../_helpers/endpointapi';
import { ProjectData, ProjectDataCmdType, UploadFile } from '../../_models/project';
import { ResourceStorageService } from './resource-storage.service';
import { AlarmQuery, IAlarmHistory } from '../../_models/alarm';
import { DaqQuery } from '../../_models/hmi';
import { CommanType } from '../command.service';

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

    uploadFile(resource: any, destination?: string): Observable<UploadFile> {
        let header = new HttpHeaders({ 'Content-Type': 'application/json' });
        let params = { resource, destination };
        return this.http.post<any>(this.endPointConfig + '/api/upload', params, { headers: header });
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

    getAlarmsHistory(query: AlarmQuery): Observable<IAlarmHistory[]> {
        let header = new HttpHeaders({ 'Content-Type': 'application/json' });
        const requestOptions: Object = {
            /* other options here */
            headers: header,
            params: {
                start: query.start.getTime(),
                end: query.end.getTime()
            },
            observe: 'response'
        };
        return this.http.get<IAlarmHistory[]>(this.endPointConfig + '/api/alarmsHistory', requestOptions).pipe(
            switchMap((response: any) => {
                if (response.body === null || response.body === undefined) {
                  return of([]);
                }
                return of(response.body);
            }),
            map((body: IAlarmHistory[]) => body)
        );
        // // let header = new HttpHeaders({ 'Content-Type': 'application/json' });
        // let params = { query: JSON.stringify(query) };
        // return this.http.get<any>(this.endPointConfig + '/api/alarmsHistory', { headers: header, params: params });
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

    getDaqValues(query: DaqQuery): Observable<any> {
        let header = new HttpHeaders({ 'Content-Type': 'application/json' });
        let params = { query: JSON.stringify(query) };
        return this.http.get<any>(this.endPointConfig + '/api/daq', { headers: header, params });
    }

    getTagsValues(tagsIds: string[]): Observable<any> {
        let header = new HttpHeaders({ 'Content-Type': 'application/json' });
        let params = { ids: JSON.stringify(tagsIds) };
        return this.http.get<any>(this.endPointConfig + '/api/getTagValue', { headers: header, params });
    }

    runSysFunction(functionName: string, parameters?: any): Observable<any> {
        let header = new HttpHeaders({ 'Content-Type': 'application/json' });
        let params = { functionName: functionName, parameters: parameters };
        return this.http.post<any>(this.endPointConfig + '/api/runSysFunction', { headers: header, params: params });
    }

    heartbeat(activity: boolean): Observable<any> {
        let header = new HttpHeaders({ 'Content-Type': 'application/json' });
        return this.http.post<any>(this.endPointConfig + '/api/heartbeat', { headers: header, params: activity });
    }

    downloadFile(fileName: string, type: CommanType): Observable<Blob> {
        let header = new HttpHeaders({ 'Content-Type': 'application/pdf' });
        let params = {
            cmd: type,
            name: fileName,
        };
        return this.http.get(this.endPointConfig + '/api/download', { headers: header, params: params, responseType: 'blob' });
    }

}
