import { Injectable } from '@angular/core';
import { ResClientService } from './resclient.service';
import { ResourceStorageService } from './resource-storage.service';
import { environment } from '../../../environments/environment';
import { ResDemoService } from './resdemo.service';
import { ResWebApiService } from './reswebapi.service';
import { AppService } from '../app.service';

@Injectable({
	providedIn: 'root'
})
export class RcgiService {

    public rcgi: ResourceStorageService;

	constructor(
		private reseWebApiService: ResWebApiService,
        private resDemoService: ResDemoService,
		private resClientService: ResClientService,
        private appService: AppService,
	) {
		this.rcgi = reseWebApiService;
		if (!environment.serverEnabled) {
			this.rcgi = resDemoService;
		} else if (appService.isClientApp) {
			this.rcgi = resClientService;
		}
	}
}
