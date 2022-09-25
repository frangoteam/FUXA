import { Component, AfterViewInit, Input, Output, EventEmitter, ChangeDetectorRef, AfterContentChecked } from '@angular/core';
import { Router } from '@angular/router';
import { MatSidenav } from '@angular/material';

import { LayoutSettings, NaviItem, NaviModeType, NavigationSettings, LinkType } from '../_models/hmi';

@Component({
    selector: 'app-sidenav',
    templateUrl: './sidenav.component.html',
    styleUrls: ['./sidenav.component.css']
})
export class SidenavComponent implements AfterViewInit, AfterContentChecked {

    @Input() sidenav: MatSidenav;
    @Output() goToPage: EventEmitter<string> = new EventEmitter();
    @Output() goToLink: EventEmitter<string> = new EventEmitter();

    viewAsLink = LinkType.address;
    viewAsAlarms = LinkType.alarms;

    logo = null;
    layout = null;
    showSidenav = false;
    layoutNavigation = new NavigationSettings();

    constructor(private router: Router,
        private changeDetector: ChangeDetectorRef) {
    }

    ngAfterViewInit() {
    }

    ngAfterContentChecked(): void {
        this.showSidenav = (this.layout) ? true : false;
        this.changeDetector.detectChanges();
    }

    onGoTo(item: NaviItem) {
        if (item.link && item.view === this.viewAsLink) {
            this.goToLink.emit(item.link);
        } else if (item.view) {
            this.goToPage.emit(item.view);
        }
    }

    public setLayout(ly: LayoutSettings) {
        this.layout = ly;
        if (this.layout.navigation) {
            this.layoutNavigation = this.layout.navigation;
            this.logo = this.layout.navigation.logo;
        }
    }
}
