import { Component, Inject, OnInit, AfterViewInit, OnDestroy, ViewChild, ChangeDetectorRef, ElementRef } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { Subscription } from "rxjs";
import { MatSidenav } from '@angular/material';
import { Router } from '@angular/router';

import { SidenavComponent } from '../sidenav/sidenav.component';
import { FuxaViewComponent } from '../fuxa-view/fuxa-view.component';
import { IframeComponent } from '../iframe/iframe.component';

import { HmiService } from '../_services/hmi.service';
import { ProjectService } from '../_services/project.service';
import { AuthService } from '../_services/auth.service';
import { GaugesManager } from '../gauges/gauges.component';
import { Hmi, View, NaviModeType, NotificationModeType, ZoomModeType, HeaderSettings } from '../_models/hmi';
import { LoginComponent } from '../login/login.component';
import { AlarmViewComponent } from '../alarms/alarm-view/alarm-view.component';

import panzoom from 'panzoom';
// declare var panzoom: any;

@Component({
	selector: 'app-home',
	templateUrl: './home.component.html',
	styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {

	@ViewChild('sidenav') sidenav: SidenavComponent;
	@ViewChild('matsidenav') matsidenav: MatSidenav;
	@ViewChild('fuxaview') fuxaview: FuxaViewComponent;
	@ViewChild('alarmsview') alarmsview: AlarmViewComponent;
	@ViewChild('container') container: ElementRef;

	@ViewChild('iframeview') iframeview: IframeComponent;

	isLoading = true;
	homeView: View = new View();
	hmi: Hmi = new Hmi();
	showSidenav = 'over';
	showHomeView = false;
	homeLink = '';
	showHomeLink = false;
	securityEnabled = false;
	backgroudColor = 'unset';
	title = '';	
	alarms = { show: false, count: 0, mode: '' };
	infos = { show: false, count: 0, mode: '' };
	headerButtonMode = NotificationModeType;
	alarmsPanelOpen = false;
	layoutHeader = new HeaderSettings();

	private subscriptionLoad: Subscription;
	private subscriptionAlarmsStatus: Subscription;

	constructor(private projectService: ProjectService,
		private changeDetector: ChangeDetectorRef,
		public dialog: MatDialog,
		private router: Router,
		private hmiService: HmiService,
		private authService: AuthService,
		private gaugesManager: GaugesManager) { }

	ngOnInit() {

	}

	ngAfterViewInit() {
		try {
			let hmi = this.projectService.getHmi();
			if (hmi) {
				this.loadHmi();
			}
			this.subscriptionLoad = this.projectService.onLoadHmi.subscribe(load => {
				this.loadHmi();
			}, error => {
				console.log('Error loadHMI');
			});
			this.subscriptionAlarmsStatus = this.hmiService.onAlarmsStatus.subscribe(event => {
				this.setAlarmsStatus(event);
            });
            this.hmiService.askAlarmsStatus();
            this.changeDetector.detectChanges();
		}
		catch (err) {
			console.log(err);
		}
	}

	ngOnDestroy() {
		try {
			if (this.subscriptionLoad) {
				this.subscriptionLoad.unsubscribe();
			}
			if (this.subscriptionAlarmsStatus) {
				this.subscriptionAlarmsStatus.unsubscribe();
			}
		} catch (e) {
		}
	}

	onGoToPage(event: string) {
		const view = this.hmi.views.find(x => x.id === event);
        this.showHomeView = (this.homeView) ? true : false;
        this.showHomeLink = false;
        this.changeDetector.detectChanges();
		if (view) {
			this.homeView = view;
			this.setBackground();
			this.fuxaview.loadHmi(this.homeView);
		}
	}

	onGoToLink(event: string) {
		if (event.indexOf('://') >= 0) {
			this.showHomeView = false;
            this.showHomeLink = true;
            this.changeDetector.detectChanges();
			this.iframeview.loadLink(event);

		} else {
			this.router.navigate([event]).then(data => {
				console.log('Route ' + event + ' exists, redirection is done');
			}).catch(err => {
				console.log('Route ' + event + '  not found, redirection stopped with no error raised');
				// try iframe link
			});
		}
	}

	onLogin() {
		let cuser = this.authService.getUser();
		if (cuser) {
			let dialogRef = this.dialog.open(DialogUserInfo, {
				id: 'myuserinfo',
				// minWidth: '250px',
				position: { top: '50px', right: '15px' },
				backdropClass: 'user-info',
				data: cuser
			});
			dialogRef.afterClosed().subscribe(result => {
				if (result) {
					this.authService.signOut();
					this.projectService.reload();
				}
			});
		} else {
			let dialogRef = this.dialog.open(LoginComponent, {
				// minWidth: '250px',
				data: {}
			});
			dialogRef.afterClosed().subscribe(result => {
			});
		}
	}

	askValue() {
		this.hmiService.askDeviceValues();
	}

	askStatus() {
		this.hmiService.askDeviceStatus();
	}

	isLoggedIn() {
		return (this.authService.getUser()) ? true : false;
	}

	onAlarmsShowMode(mode: string) {
		let ele = document.getElementById("alarms-panel");
		if (mode === 'expand') {
			ele.classList.add("is-full-active");
			// ele.classList.remove('is-active');			
			this.alarmsPanelOpen = true;
			this.alarmsview.startAskAlarmsValues();
		} else if (mode === 'collapse') {
			ele.classList.add('is-active');
			ele.classList.remove('is-full-active');
			this.alarmsPanelOpen = true;
			this.alarmsview.startAskAlarmsValues();
		} else {
			// ele.classList.toggle("is-active");
			ele.classList.remove('is-active');
			ele.classList.remove('is-full-active');
			this.alarmsPanelOpen = false;
		}
	}

	private goTo(destination: string) {
		this.router.navigate([destination]);//, this.ID]);
	}

	private loadHmi() {
		let hmi = this.projectService.getHmi();
		if (hmi) {
			this.hmi = hmi;
		}
		if (this.hmi && this.hmi.views && this.hmi.views.length > 0) {
			if (this.hmi.layout && this.hmi.layout.start) {
				const startView = this.hmi.views.find(x => x.id === this.hmi.layout.start);
				if (startView) {
					this.homeView = startView;
				}
			} else {
				this.homeView = this.hmi.views[0];
			}
			this.setBackground();
			// check sidenav
			this.showSidenav = null;
			if (this.hmi.layout) {
				let nvoid = NaviModeType[this.hmi.layout.navigation.mode];
				if (this.hmi.layout && nvoid !== NaviModeType.void) {
					if (nvoid === NaviModeType.over) {
						this.showSidenav = 'over';
					} else if (nvoid === NaviModeType.fix) {
						this.showSidenav = 'side';
						this.matsidenav.open();
					} else if (nvoid === NaviModeType.push) {
						this.showSidenav = 'push';
					}
					this.sidenav.setLayout(this.hmi.layout);
				}
				if (this.hmi.layout.header) {
					this.title = this.hmi.layout.header.title;
					if (this.hmi.layout.header.alarms) {
						this.alarms.mode = this.hmi.layout.header.alarms;
					}
					if (this.hmi.layout.header.infos) {
						this.infos.mode = this.hmi.layout.header.infos;
					}
					this.checkHeaderButton();
					this.layoutHeader = this.hmi.layout.header;
				}
				if (this.hmi.layout.zoom && ZoomModeType[this.hmi.layout.zoom] === ZoomModeType.enabled) {
					setTimeout(() => {
						let element: HTMLElement = document.querySelector('#home');
						if (element && panzoom) {
							panzoom(element, {
								bounds: true,
								boundsPadding: 0.05,
							});		
						}
                		this.container.nativeElement.style.overflow = 'hidden';
					}, 1000);
				}
			}
			this.showHomeView = (this.homeView) ? true : false;
		}
		if (this.homeView && this.fuxaview) {
			this.fuxaview.loadHmi(this.homeView);
		}
		this.isLoading = false;
		this.securityEnabled = this.projectService.isSecurityEnabled();
	}

	private setBackground() {
		if (this.homeView && this.homeView.profile) {
			this.backgroudColor = this.homeView.profile.bkcolor;
		}
	}

	private checkHeaderButton() {
		let fix = <NotificationModeType>Object.keys(NotificationModeType)[Object.values(NotificationModeType).indexOf(NotificationModeType.fix)];
		let float = <NotificationModeType>Object.keys(NotificationModeType)[Object.values(NotificationModeType).indexOf(NotificationModeType.float)];
		if (this.alarms.mode === fix || (this.alarms.mode === float && this.alarms.count > 0)) {
			this.alarms.show = true;
        }
        else {
            this.alarms.show = false;
        }
		if (this.infos.mode === fix || (this.infos.mode === float && this.infos.count > 0)) {
			this.infos.show = true;
		} else {
            this.infos.show = false;
        }
	}

	private setAlarmsStatus(status: any) {
		if (status) {
			this.alarms.count = status.highhigh + status.high + status.low;
            this.infos.count = status.info;
            this.checkHeaderButton();
		}
	}

}

@Component({
	selector: 'user-info',
	templateUrl: 'userinfo.dialog.html',
})
export class DialogUserInfo {
	constructor(
		public dialogRef: MatDialogRef<DialogUserInfo>,
		@Inject(MAT_DIALOG_DATA) public data: any) { }

	onOkClick(): void {
		this.dialogRef.close(true);
	}
}