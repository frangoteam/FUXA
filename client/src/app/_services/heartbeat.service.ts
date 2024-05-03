import { Injectable } from '@angular/core';
import { ResourceStorageService } from './rcgi/resource-storage.service';
import { RcgiService } from './rcgi/rcgi.service';
import { Subscription, interval } from 'rxjs';
import { AuthService } from './auth.service';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';

@Injectable({
	providedIn: 'root'
})
export class HeartbeatService {

	private heartbeatInterval = 5 * 60 * 1000;
	private server: ResourceStorageService;
	private heartbeatSubscription: Subscription;
	private activity = false;
	constructor(
		private authService: AuthService,
		private router: Router,
		private rcgiService: RcgiService
	) {
		this.server = rcgiService.rcgi;
	}

	startHeartbeatPolling(): void {
		if (this.server) {
			this.stopHeartbeatPolling();
			this.heartbeatSubscription = interval(this.heartbeatInterval).subscribe(() => {
				this.server.heartbeat(this.activity).subscribe(res => {
					if (res?.message === 'tokenRefresh' && res?.token) {
						this.authService.setNewToken(res.token);
					}
				}, (error) => {
					if (error instanceof HttpErrorResponse) {
						if (error.status === 403) {
							this.router.navigateByUrl('/');
						}
					}
				});
			});
		}
	}

	stopHeartbeatPolling(): void {
		if (this.heartbeatSubscription) {
			this.heartbeatSubscription.unsubscribe();
		}
	}

	setActivity(activity: boolean) {
		this.activity = activity;
	}
}
