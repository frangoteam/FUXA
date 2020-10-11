import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, AfterContentChecked } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from "rxjs";

import { ProjectService } from './_services/project.service';

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
		private fuxaLanguage: TranslateService,
		location: Location) {
		this.location = location;

		// this language will be used as a fallback when a translation isn't found in the current language
		fuxaLanguage.setDefaultLang('en');
		// the lang to use, if the lang isn't available, it will use the current loader to get them
		fuxaLanguage.use('en');
	}

	ngOnInit() {
	}

	ngAfterViewInit() {
    }

    ngAfterContentChecked() {
		try {
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