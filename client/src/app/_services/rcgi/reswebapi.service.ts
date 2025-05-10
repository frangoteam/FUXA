
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { map, Observable, of, switchMap } from 'rxjs';

import { EndPointApi } from '../../_helpers/endpointapi';
import { ProjectData, ProjectDataCmdType, UploadFile } from '../../_models/project';
import { ResourceStorageService } from './resource-storage.service';
import { AlarmQuery, AlarmBaseType, AlarmsFilter } from '../../_models/alarm';
import { DaqQuery } from '../../_models/hmi';
import { CommanType } from '../command.service';
import { Report, ReportFile, ReportsQuery } from '../../_models/report';
import { ToastrService } from 'ngx-toastr';
import { TranslateService } from '@ngx-translate/core';
import { Role } from '../../_models/user';

@Injectable()
export class ResWebApiService implements ResourceStorageService {

    public endPointConfig = EndPointApi.getURL();
    public onRefreshProject: () => boolean;

    constructor(
        private http: HttpClient,
        private translateService: TranslateService,
        private toastr: ToastrService) {
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

    getAlarmsValues(alarmFilter?: AlarmsFilter): Observable<AlarmBaseType[]> {
        let header = new HttpHeaders({ 'Content-Type': 'application/json' });
        let params = alarmFilter ? { filter: JSON.stringify(alarmFilter) } : null;
        return this.http.get<any>(this.endPointConfig + '/api/alarms', { headers: header, params });
    }

    getAlarmsHistory(query: AlarmQuery): Observable<AlarmBaseType[]> {
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
        return this.http.get<AlarmBaseType[]>(this.endPointConfig + '/api/alarmsHistory', requestOptions).pipe(
            switchMap((response: any) => {
                if (response.body === null || response.body === undefined) {
                  return of([]);
                }
                return of(response.body);
            }),
            map((body: AlarmBaseType[]) => body)
        );
        // // let header = new HttpHeaders({ 'Content-Type': 'application/json' });
        // let params = { query: JSON.stringify(query) };
        // return this.http.get<any>(this.endPointConfig + '/api/alarmsHistory', { headers: header, params: params });
    }

    setAlarmAck(name: string): Observable<any> {
        return new Observable((observer) => {
            let header = new HttpHeaders({ 'Content-Type': 'application/json' });
            this.http.post<any>(this.endPointConfig + '/api/alarmack', { headers: header, params: name }).subscribe(result => {
                observer.next(null);
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

    getTagsValues(tagsIds: string[], sourceScriptName?: string): Observable<any> {
        let header = new HttpHeaders({ 'Content-Type': 'application/json' });
        let params = { ids: JSON.stringify(tagsIds), sourceScriptName: sourceScriptName };
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

    getRoles(): Observable<Role[]> {
        let header = new HttpHeaders({ 'Content-Type': 'application/json' });
        return this.http.get<Role[]>(this.endPointConfig + '/api/roles', { headers: header });
    }

    setRoles(roles: Role[]): Observable<any> {
        return new Observable((observer) => {
            let header = new HttpHeaders({ 'Content-Type': 'application/json' });
            this.http.post<Role[]>(this.endPointConfig + '/api/roles', { headers: header, params: roles }).subscribe(result => {
                observer.next(null);
            }, err => {
                observer.error(err);
            });
        });
    }

    removeRoles(roles: Role[]): Observable<any> {
        let header = new HttpHeaders({ 'Content-Type': 'application/json' });
        return this.http.delete<any>(this.endPointConfig + '/api/roles', { headers: header, params: { roles:  JSON.stringify(roles) } });
    }

    getReportsDir(report: Report): Observable<string[]> {
        let header = new HttpHeaders({ 'Content-Type': 'application/json' });
        let params = {
            id: report.id,
            name: report.name,
        };
        return this.http.get<string[]>(this.endPointConfig + '/api/reportsdir', { headers: header, params: params });
    }

    getReportsQuery(query: ReportsQuery): Observable<ReportFile[]> {
        let header = new HttpHeaders({ 'Content-Type': 'application/json' });
        let params = { query: JSON.stringify(query) };
        return this.http.get<ReportFile[]>(this.endPointConfig + '/api/reportsQuery', { headers: header, params: params });
    }

    buildReport(report: Report): Observable<void> {
        return new Observable((observer) => {
                let header = new HttpHeaders({ 'Content-Type': 'application/json' });
                let params = report;
                this.http.post<void>(this.endPointConfig + '/api/reportBuild', { headers: header, params: params }).subscribe(result => {
                    observer.next(null);
                    var msg = '';
                    this.translateService.get('msg.report-build-forced').subscribe((txt: string) => { msg = txt; });
                    this.toastr.success(msg);
                }, err => {
                    console.error(err);
                    observer.error(err);
                    this.notifyError(err);
                });
        });
    }

    removeReportFile(fileName: string): Observable<void> {
        let header = new HttpHeaders({ 'Content-Type': 'application/json' });
        let params = { fileName };
        return this.http.post<any>(this.endPointConfig + '/api/reportRemoveFile', { headers: header, params: params });
    }

    private notifyError(err: any) {
        var msg = '';
        this.translateService.get('msg.report-build-error').subscribe((txt: string) => { msg = txt; });
        this.toastr.error(msg, '', {
            timeOut: 3000,
            closeButton: true,
            disableTimeOut: true
        });
    }
}
