import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { EndPointApi } from '../_helpers/endpointapi';
import { environment } from '../../environments/environment';
import { ResWebApiService } from './rcgi/reswebapi.service';
import { ResDemoService } from './rcgi/resdemo.service';
import { ResClientService } from './rcgi/resclient.service';
import { ResourceStorageService } from './rcgi/resource-storage.service';
import { AppService } from './app.service';
import { ApiKey } from '../_models/apikey';

@Injectable()
export class ApiKeysService {

    private endPointConfig: string = EndPointApi.getURL();

    private storage: ResourceStorageService;

    constructor(private appService: AppService,
                private resewbApiService: ResWebApiService,
                private resDemoService: ResDemoService,
                private resClientService: ResClientService) {
        this.storage = resewbApiService;
        if (!environment.serverEnabled || appService.isDemoApp) {
            this.storage = resDemoService;
        } else if (appService.isClientApp) {
            this.storage = resClientService;
        }
    }

    getApiKeys(): Observable<ApiKey[]> {
        return new Observable((observer) => {
            this.storage.getApiKeys().subscribe(result => {
                observer.next(result);
            }, err => {
                console.error(err);
                observer.error(err);
            });
        });
    }

    setApiKey(apiKey: ApiKey) {
        return new Observable((observer) => {
            this.storage.setApiKeys([apiKey]).subscribe(result => {
                observer.next(result);
            }, err => {
                console.error(err);
                observer.error(err);
            });
        });
    }

    removeApiKey(apiKey: ApiKey) {
        return new Observable((observer) => {
            this.storage.removeApiKeys([apiKey]).subscribe(result => {
                observer.next(result);
            }, err => {
                console.error(err);
                observer.error(err);
            });
        });
    }
}
