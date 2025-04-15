import { Injectable } from '@angular/core';
import { ResourceStorageService } from './rcgi/resource-storage.service';
import { RcgiService } from './rcgi/rcgi.service';
import { Subscription, interval } from 'rxjs';
import { AuthService } from './auth.service';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { ProjectService } from './project.service';

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
		private projectService: ProjectService,
		private router: Router,
		private rcgiService: RcgiService
	) {
		this.server = rcgiService.rcgi;
	}

	startHeartbeatPolling(): void {
		if (this.server) {
			let lastMessage = '';
			this.stopHeartbeatPolling();
			this.heartbeatSubscription = interval(this.heartbeatInterval).subscribe(() => {
				this.server.heartbeat(this.activity).subscribe(res => {
					if (res?.message === 'tokenRefresh' && res?.token) {
						this.authService.setNewToken(res.token);
					} else if (res?.message === 'guest' && res?.token) {
						console.log('login as guest');
						this.authService.signOut();
						if (lastMessage !== res.message) {
							console.log('refresh');
                    		this.projectService.reload();
							this.router.navigateByUrl('/');
						}
					}
					lastMessage = res?.message;
				}, (error) => {
					if (error instanceof HttpErrorResponse) {
						if (error.status === 401 || error.status === 403) {
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
