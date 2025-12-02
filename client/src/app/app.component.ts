import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ChangeDetectorRef, Inject } from '@angular/core';
import { DOCUMENT, Location } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Observable, Subject, Subscription, combineLatest, fromEvent, interval, map, merge, of, startWith, switchMap, takeUntil, tap, timer } from 'rxjs';

import { environment } from '../environments/environment';

import { ProjectService } from './_services/project.service';
import { SettingsService } from './_services/settings.service';
import { UserGroups } from './_models/user';
import { AppService } from './_services/app.service';
import { HeartbeatService } from './_services/heartbeat.service';
import { AuthService } from './_services/auth.service';
import { HmiService } from './_services/hmi.service';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.scss']
})

export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
	title = 'app';
	location: Location;
	showdev = false;
	isLoading = false;
	serverErrorBanner$: Observable<boolean>;

	@ViewChild('fabmenu', {static: false}) fabmenu: any;

	private subscriptionLoad: Subscription;
	private subscriptionShowLoading: Subscription;
	private destroy$ = new Subject<void>();
    private securityEnabled = false;

	constructor(@Inject(DOCUMENT) private document: Document,
		private router: Router,
		private appService: AppService,
		private projectService: ProjectService,
		private settingsService: SettingsService,
		private translateService: TranslateService,
		private heartbeatService: HeartbeatService,
		private cdr: ChangeDetectorRef,
		private hmiService: HmiService,
		private authService: AuthService,
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


		this.serverErrorBanner$ = combineLatest([
			this.hmiService.onServerConnection$,
			this.authService.currentUser$
		]).pipe(
			switchMap(([connectionStatus, userProfile]) =>
				merge(
					of(false),
					timer(35000).pipe(map(() => (this.securityEnabled && !userProfile) ? false : true)),
				).pipe (
					startWith(false),
				)
			),
			takeUntil(this.destroy$)
		);
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
				this.applyCustomCss();
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
				this.cdr.detectChanges();
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
		this.destroy$.next(null);
		this.destroy$.complete();
	}

	applyCustomCss() {
		let hmi = this.projectService.getHmi();
		if (hmi?.layout?.customStyles) {
			const style = this.document.createElement('style');
			style.textContent = hmi.layout.customStyles;
			this.document.head.appendChild(style);
		}
	}

	checkSettings() {
		let hmi = this.projectService.getHmi();
		if (hmi && hmi.layout && hmi.layout.showdev === false) {
			this.showdev = false;
		} else {
			this.showdev = true;
		}
		this.securityEnabled = this.projectService.isSecurityEnabled();
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
