import { Component, Input, Output, EventEmitter, ChangeDetectorRef, AfterContentChecked } from '@angular/core';
import { MatSidenav } from '@angular/material/sidenav';
import { Location } from '@angular/common';

import { LayoutSettings, NaviItem, NavigationSettings, LinkType } from '../_models/hmi';
import { Router } from '@angular/router';
import { ProjectService } from '../_services/project.service';

@Component({
    selector: 'app-sidenav',
    templateUrl: './sidenav.component.html',
    styleUrls: ['./sidenav.component.css']
})
export class SidenavComponent implements AfterContentChecked {

    @Input() sidenav: MatSidenav;
    @Output() goToPage: EventEmitter<string> = new EventEmitter();
    @Output() goToLink: EventEmitter<string> = new EventEmitter();

    viewAsLink = LinkType.address;
    viewAsAlarms = LinkType.alarms;

    logo = null;
    layout = null;
    showSidenav = false;
    layoutNavigation = new NavigationSettings();

    constructor(private location: Location,
                private router: Router,
                private projectService: ProjectService,
                private changeDetector: ChangeDetectorRef) {
    }

    ngAfterContentChecked(): void {
        this.showSidenav = (this.layout) ? true : false;
        this.changeDetector.detectChanges();
    }

    onGoTo(item: NaviItem) {
        if (this.location.path().startsWith('/home/')) {
            const view = this.projectService.getViewFromId(item.view);
            if (view) {
                this.router.navigate(['/home', view.name]);
            }
        }
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
