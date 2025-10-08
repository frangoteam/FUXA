import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';

import { SetupComponent } from '../editor/setup/setup.component';
import { ProjectService, SaveMode } from '../_services/project.service';

@Component({
    selector: 'app-iframe',
    templateUrl: './iframe.component.html',
    styleUrls: ['./iframe.component.css']
})
export class IframeComponent implements OnInit, OnDestroy {

    private subscription: any;
    urlSafe: SafeResourceUrl;
    private _link: string;
    @Input() set link(value: string) {
        this._link = value;
        this.loadLink(value);
    }

    constructor(private activeroute: ActivatedRoute,
        private router: Router,
        public sanitizer: DomSanitizer,
        private dialog: MatDialog,
        private projectService: ProjectService) { }

    ngOnInit() {
        if (this._link) {
            // input
            this.urlSafe = this.sanitizer.bypassSecurityTrustResourceUrl(this._link);
        } else {
            this.subscription = this.activeroute.params.subscribe(params => {
                // routing
                this._link = params['url'] || '/nodered/';
                this.urlSafe = this.sanitizer.bypassSecurityTrustResourceUrl(this._link);
            });
        }
    }

    ngOnDestroy() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }

    loadLink(link: string) {
        this._link = link;
        if (this._link) {
            // Convert relative URLs to absolute URLs
            let absoluteUrl = this._link;
            if (this._link.startsWith('/')) {
                // Relative URL starting with / - add current origin
                absoluteUrl = window.location.origin + this._link;
            } else if (!this._link.startsWith('http://') && !this._link.startsWith('https://')) {
                // Relative URL without leading / - add current origin and /
                absoluteUrl = window.location.origin + '/' + this._link;
            }
            this.urlSafe = this.sanitizer.bypassSecurityTrustResourceUrl(absoluteUrl);
        }
    }

    onSetup() {
        this.projectService.saveProject(SaveMode.Current);
        let dialogRef = this.dialog.open(SetupComponent, {
            position: { top: '60px' },
        });
    }

    onClose() {
        this.router.navigate(['/editor']);
    }
}
