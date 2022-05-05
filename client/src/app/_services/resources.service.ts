import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

import { EndPointApi } from '../_helpers/endpointapi';
import { Resources, ResourceType } from '../_models/resources';

@Injectable({
    providedIn: 'root'
})
export class ResourcesService {

    private endPointConfig: string = EndPointApi.getURL();

    constructor(private http: HttpClient) { }

    getResources(type: ResourceType): Observable<Resources> {
        let header = new HttpHeaders({ 'Content-Type': 'application/json' });
        let params = { type: type };
        return this.http.get<Resources>(this.endPointConfig + '/api/resources/' + type, { headers: header, params: params });
    }
}
