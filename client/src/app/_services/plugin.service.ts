import { Injectable, Output, EventEmitter } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

import { EndPointApi } from '../_helpers/endpointapi';
import { Plugin } from '../_models/plugin';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class PluginService {

    @Output() onPluginsChanged: EventEmitter<any> = new EventEmitter();

    private endPointConfig: string = EndPointApi.getURL();

    constructor(private http: HttpClient) {
    }

    getPlugins() {
        return this.http.get<Plugin[]>(this.endPointConfig + '/api/plugins');
    }

    installPlugin(plugin: Plugin) {
        return new Observable((observer) => {
            if (environment.serverEnabled) {
                let header = new HttpHeaders({ 'Content-Type': 'application/json' });
                this.http.post<any>(this.endPointConfig + '/api/plugins', { headers: header, params: plugin }).subscribe(result => {
                    observer.next();
                    this.onPluginsChanged.emit();
                }, err => {
                    console.error(err);
                    observer.error(err);
                });
            } else {
                observer.next();
            }
        });
    }

    removePlugin(plugin: Plugin) {
        return new Observable((observer) => {
            if (environment.serverEnabled) {
                let header = new HttpHeaders({ 'Content-Type': 'application/json' });
                this.http.delete<any>(this.endPointConfig + '/api/plugins', { headers: header, params: {param:  plugin.name} }).subscribe(result => {
                    observer.next();
                    this.onPluginsChanged.emit();
                }, err => {
                    console.error(err);
                    observer.error(err);
                });
            } else {
                observer.next();
            }
        });
    }
}
