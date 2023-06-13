import { Injectable } from '@angular/core';
import { ResourceStorageService } from './rcgi/resource-storage.service';
import { RcgiService } from './rcgi/rcgi.service';
import { Subscription, interval } from 'rxjs';

@Injectable({
	providedIn: 'root'
})
export class HeartbeatService {

	private server: ResourceStorageService;
	private heartbeatSubscription: Subscription;

	constructor(
		private rcgiService: RcgiService
	) {
		this.server = rcgiService.rcgi;
	}

	startHeartbeatPolling(): void {
		if (this.server) {
			this.stopHeartbeatPolling();
			this.heartbeatSubscription = interval(10000).subscribe(() => {
				this.server.heartbeat().subscribe(res => {
				});
			});
		}
	}

	stopHeartbeatPolling(): void {
		if (this.heartbeatSubscription) {
			this.heartbeatSubscription.unsubscribe();
		}
	}
}
