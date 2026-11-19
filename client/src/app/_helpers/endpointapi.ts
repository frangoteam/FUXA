import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient, HttpXhrBackend, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class EndPointApi {
    private static url: string = null;

    public static getBasePath(): string {
        // this uses the base defined in main.js to obtain the base path.
        // if not found, it simply ignores it
        // <base href="/fuxa/"> -> "/fuxa" ; "/" -> ""
        const href = document.querySelector('base')?.getAttribute('href') || '/';
        try {
            return new URL(href, location.origin).pathname.replace(/\/+$/, '');
        }
        catch (err) {
            return '';
        }
    }

    public static getURL() {
        if (!this.url) {
            if (environment.apiEndpoint) {
                this.url = environment.apiEndpoint;
            } else {
                const origin = location.origin;
                let path = location.origin.split('/')[2];
                const protocol = location.origin.split(':')[0];
                const temp = path.split(':')[0];
                if (temp.length > 1 && environment.apiPort) {
                    path = temp + ':' + environment.apiPort;
                }
                this.url = protocol + '://' + path + this.getBasePath();
            }
        }
        return this.url;
    }

    /**
     * @deprecated as of version 1.3.3 this is not used anywhere
     */
    public static getRemoteURL(destIp: string) {
        const protocol = location.origin.split(':')[0];
        const path = destIp + ':' + environment.apiPort;
        return protocol + '://' + path + '/api';

    }

    public static resolveUrl = (input?: string) => {
        // todo check what happens when behind a proxy
        if (!input) {
            return '';
        }
        try { return new URL(input, window.location.origin).toString(); }
        catch { return input.startsWith('/') ? input : '/' + input; }
    };
    static getJSONFromURL(jsonURL: string): Observable<any> {
        // Accept (not Content-Type) keeps this a "simple" CORS request: a Content-Type header on a GET
        // forces a preflight OPTIONS request that many public servers (e.g. raw.githubusercontent.com) reject
        let header = new HttpHeaders({ 'Accept': 'application/json' });
        let _http = new HttpClient(new HttpXhrBackend({ 
            build: () => new XMLHttpRequest() 
        }));
        return _http.get(jsonURL, { headers : header});
    }
}
