import { Component, AfterViewInit, Input, Output, EventEmitter, ChangeDetectorRef, AfterContentChecked } from '@angular/core';
import { Router } from '@angular/router';
import { MatSidenav } from '@angular/material';

import { LayoutSettings, NaviItem, NaviModeType, NavigationSettings } from '../_models/hmi';

@Component({
    selector: 'app-sidenav',
    templateUrl: './sidenav.component.html',
    styleUrls: ['./sidenav.component.css']
})
export class SidenavComponent implements AfterViewInit, AfterContentChecked {

    @Input() sidenav: MatSidenav;
    @Output() goToPage: EventEmitter<string> = new EventEmitter();
    @Output() goToLink: EventEmitter<string> = new EventEmitter();

    layout = null;
    showSidenav = false;
    layoutNavigation = new NavigationSettings();

    constructor(private router: Router,
        private changeDetector: ChangeDetectorRef) { }

    ngAfterViewInit() {
    }

    ngAfterContentChecked(): void {
        this.showSidenav = (this.layout) ? true : false;
        this.changeDetector.detectChanges();
    }

    onGoTo(item: NaviItem) {
        if (item.view) {
            this.goToPage.emit(item.view);
        } else if (item.link) {
            this.goToLink.emit(item.link);
        }
    }

    public setLayout(ly: LayoutSettings) {
        this.layout = ly;
        if (this.layout.navigation) {
            this.layoutNavigation = this.layout.navigation;
        }
    }
}
