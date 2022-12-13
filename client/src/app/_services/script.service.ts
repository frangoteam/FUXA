import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

import { EndPointApi } from '../_helpers/endpointapi';
import { environment } from '../../environments/environment';
import { Script, ScriptMode } from '../_models/script';

@Injectable({
    providedIn: 'root'
})
export class ScriptService {

    private endPointConfig: string = EndPointApi.getURL();

    constructor(private http: HttpClient) { }

    runScript(script: Script) {
        return new Observable((observer) => {

            if (!script.mode || script.mode == ScriptMode.SERVER) {
                if (environment.serverEnabled) {
                    let header = new HttpHeaders({ 'Content-Type': 'application/json' });
                    let params = { script: script };
                    this.http.post<any>(this.endPointConfig + '/api/runscript', { headers: header, params: params }).subscribe(result => {
                        observer.next();
                    }, err => {
                        console.error(err);
                        observer.error(err);
                    });
                } else {
                    observer.next();
                }
            } else {
                if (script.parameters && script.parameters.length > 0) {
                    console.warn('TODO: Script with mode CLIENT not work with parameters.');
                }
                eval(script.code);
            }
        });
    }
}
