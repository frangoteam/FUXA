import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

import { EndPointApi } from '../_helpers/endpointapi';

import { LogsRequest } from '../_models/diagnose';

@Injectable({
    providedIn: 'root'
})
export class DiagnoseService {

    private endPointConfig: string = EndPointApi.getURL();

    constructor(private http: HttpClient) {
    }

    getLogsDir() {
        return this.http.get<string[]>(this.endPointConfig + '/api/logsdir');
    }

    getLogs(logReq: LogsRequest): Observable<any> {
        let header = new HttpHeaders({ 'Content-Type': 'application/json' });
        const requestOptions: Object = {
            /* other options here */
            responseType: 'text',
            headers: header,
            params: logReq,
            observe: 'response'
        }
        return this.http.get<any>(this.endPointConfig + '/api/logs', requestOptions);
    }
}
