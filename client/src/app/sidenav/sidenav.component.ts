import { Component, Input, Output, EventEmitter, ChangeDetectorRef, AfterContentChecked } from '@angular/core';
import { MatSidenav } from '@angular/material/sidenav';
import { Location } from '@angular/common';

import { LayoutSettings, NaviItem, NavigationSettings, LinkType } from '../_models/hmi';
import { Router } from '@angular/router';
import { ProjectService } from '../_services/project.service';
import { LanguageService } from '../_services/language.service';
import { Utils } from '../_helpers/utils';

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
    layout: LayoutSettings = null;
    showSidenav = false;
    layoutNavigation = new NavigationSettings();
    expandedItems: Set<string> = new Set();

    constructor(private location: Location,
                private router: Router,
                private projectService: ProjectService,
                private languageService: LanguageService,
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

    toggleSubMenu(item: NaviItem) {
        if (item.id && item.children?.length) {
            if (this.expandedItems.has(item.id)) {
                this.expandedItems.delete(item.id);
            } else {
                this.expandedItems.add(item.id);
            }
            this.changeDetector.detectChanges();
        }
    }

    isExpanded(item: NaviItem): boolean {
        return item.id ? this.expandedItems.has(item.id) : false;
    }

    public setLayout(layout: LayoutSettings) {
        this.layout = Utils.clone(layout);
        if (this.layout.navigation) {
            this.layoutNavigation = this.layout.navigation;
            this.logo = this.layout.navigation.logo;
            this.layout.navigation.items?.forEach(item => {
                item.text = this.languageService.getTranslation(item.text) ?? item.text;
                
                if (!item.id) {
                    item.id = Utils.getRandomId();
                }
                item.children?.forEach(child => {
                    child.text = this.languageService.getTranslation(child.text) ?? child.text;
                    if (!child.id) {
                        child.id = Utils.getRandomId();
                    }
                });
            });
        }
    }
}
