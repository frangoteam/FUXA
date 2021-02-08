import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from "rxjs";

import { ProjectService } from './_services/project.service';
import { SettingsService } from './_services/settings.service';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.css']
})

export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
	title = 'app';
	location: Location;
	showdev = false;

	@ViewChild('fabmenu') fabmenu: any;
	private subscriptionLoad: Subscription;

	constructor(private router: Router,
		private projectService: ProjectService,
		private settingsService: SettingsService,
		location: Location) {
		this.location = location;
	}

	ngOnInit() {
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
				console.log('Error loadHMI');
			});
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
		let list = ['', '/lab', '/home'],
			route = this.location.path();
		return (list.indexOf(route) > -1);
	}

	getClass() {
		let route = this.location.path();
		if (route.startsWith('/view')) {
            return 'work-void';
        }
		return (this.isHidden()) ? 'work-home' : 'work-editor';
	}

    showDevNavigation() {
        let route = this.location.path();
        if (route.startsWith('/view')) {
            return false;
        }
        return this.showdev;
    }

	onGoTo(goto) {
		this.router.navigate([goto]);
		this.fabmenu.toggle();
	}
}