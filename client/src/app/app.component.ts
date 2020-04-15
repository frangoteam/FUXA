import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.css']
})

export class AppComponent implements OnInit, AfterViewInit {
	title = 'app';
	location: Location;

	@ViewChild('fabmenu') fabmenu: any;

	constructor(private router: Router,
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

	isHidden() {
		let list = ['/lab', '/home'],
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
        return true;
    }

	onGoTo(goto) {
		this.router.navigate([goto]);
		this.fabmenu.toggle();
	}
}