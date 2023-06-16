import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Subscription, fromEvent, interval, merge, switchMap, tap } from 'rxjs';

import { environment } from '../environments/environment';

import { ProjectService } from './_services/project.service';
import { SettingsService } from './_services/settings.service';
import { UserGroups } from './_models/user';
import { AppService } from './_services/app.service';
import { HeartbeatService } from './_services/heartbeat.service';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.css']
})

export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
	title = 'app';
	location: Location;
	showdev = false;
	isLoading = false;

	@ViewChild('fabmenu', {static: false}) fabmenu: any;
	private subscriptionLoad: Subscription;
	private subscriptionShowLoading: Subscription;

	constructor(private router: Router,
		private appService: AppService,
		private projectService: ProjectService,
		private settingsService: SettingsService,
		private translateService: TranslateService,
		private heartbeatService: HeartbeatService,
		location: Location
	) {
		this.location = location;
	}

	ngOnInit() {
		console.log(`FUXA v${environment.version}`);
		this.heartbeatService.startHeartbeatPolling();

		// capture events for the token refresh
		const inactivityDuration = 1 * 60 * 1000;
		const activity$ = merge(
			fromEvent(document, 'click'),
			fromEvent(document, 'touchstart')
		);
		activity$.pipe(
			tap(() => this.heartbeatService.setActivity(true)),
			switchMap(() => interval(inactivityDuration))
		).subscribe(() => {
			this.heartbeatService.setActivity(false);
		});
	}

	ngAfterViewInit() {
		try {
			this.settingsService.init();
			let hmi = this.projectService.getHmi();
			if (hmi) {
				this.checkSettings();
			}
			this.subscriptionLoad = this.projectService.onLoadHmi.subscribe(load => {
				this.checkSettings();
			}, error => {
				console.error('Error loadHMI');
			});
			// define user groups text
			this.translateService.get('general.usergroups').subscribe((txt: string) => {
				let grpLabels = txt.split(',');
				if (grpLabels && grpLabels.length > 0) {
					for (let i = 0; i < grpLabels.length && i < UserGroups.Groups.length; i++) {
						UserGroups.Groups[i].label = grpLabels[i];
					}
				}
			});
			// show loading manager
			this.subscriptionShowLoading = this.appService.onShowLoading.subscribe(show => {
				this.isLoading = show;
			}, error => {
				this.isLoading = false;
				console.error('Error to show loading');
			});
		}
		catch (err) {
			console.error(err);
		}
	}

	ngOnDestroy() {
		try {
			if (this.subscriptionLoad) {
				this.subscriptionLoad.unsubscribe();
			}
			if (this.subscriptionShowLoading) {
				this.subscriptionShowLoading.unsubscribe();
			}
		} catch (e) {
		}
	}

	checkSettings() {
		let hmi = this.projectService.getHmi();
		if (hmi && hmi.layout && hmi.layout.showdev === false) {
			this.showdev = false;
		} else {
			this.showdev = true;
		}
	}

	isHidden() {
		const urlEnd = this.location.path();
		if (!urlEnd || urlEnd.startsWith('/home') || urlEnd === '/lab') {
			return true;
		}
		return false;
	}

	getClass() {
		const route = this.location.path();
		if (route.startsWith('/view')) {
            return 'work-void';
        }
		return (this.isHidden()) ? 'work-home' : 'work-editor';
	}

    showDevNavigation() {
        const route = this.location.path();
        if (route.startsWith('/view')) {
            return false;
        }
        return this.showdev;
    }

	onGoTo(goto) {
		this.router.navigate([goto]);
		this.fabmenu.toggle();
		//TODO!
        if (!this.location.path().includes(goto) && ['home', 'lab'].indexOf(goto) !== -1) {
			if (goto === 'lab') {
				this.router.navigate(['']);
				setTimeout(() => {
					this.router.navigate([goto]);
				}, 0);
			}
		}
	}
}
