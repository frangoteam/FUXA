import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';

@Component({
    selector: 'app-iframe',
    templateUrl: './iframe.component.html',
    styleUrls: ['./iframe.component.css']
})
export class IframeComponent implements OnInit, OnDestroy {

    private subscription: any;
    urlSafe: SafeResourceUrl;

    @Input() link: string;

    constructor(private activeroute: ActivatedRoute,
        public sanitizer: DomSanitizer) { }

    ngOnInit() {
        if (this.link) {
            // input
            this.urlSafe = this.sanitizer.bypassSecurityTrustResourceUrl(this.link);
        } else {
            this.subscription = this.activeroute.params.subscribe(params => {
                // routing
                this.link = params['url'];
                this.urlSafe = this.sanitizer.bypassSecurityTrustResourceUrl(this.link);
            });
        }
    }

    ngOnDestroy() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }

    loadLink(link: string) {
        this.link = link;
        if (this.link) {
            this.urlSafe = this.sanitizer.bypassSecurityTrustResourceUrl(this.link);
        }
    }
}
