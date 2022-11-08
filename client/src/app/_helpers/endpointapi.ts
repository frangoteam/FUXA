import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable()
export class EndPointApi {
    private static url: string = null;

    public static getURL() {
        if (!this.url) {
            if (environment.apiEndpoint) {
                this.url = environment.apiEndpoint;
            } else {
                const origin = location.origin;
                let path = location.origin.split('/')[2];
                const protocoll = location.origin.split(':')[0];
                const temp = path.split(':')[0];
                if (temp.length > 1 && environment.apiPort) {
                    path = temp + ':' + environment.apiPort;
                }
                this.url = protocoll + '://' + path;
            }
        }
        return this.url;
    }

    public static getRemoteURL(destIp: string) {
        const protocoll = location.origin.split(':')[0];
        const path = destIp + ':' + environment.apiPort;
        return protocoll + '://' + path + '/api';

    }
}
