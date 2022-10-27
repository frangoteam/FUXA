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
    private _link: string;
    @Input() set link(value: string) {
        this._link = value;
        this.loadLink(value);
    }

    constructor(private activeroute: ActivatedRoute,
        public sanitizer: DomSanitizer) { }

    ngOnInit() {
        if (this._link) {
            // input
            this.urlSafe = this.sanitizer.bypassSecurityTrustResourceUrl(this._link);
        } else {
            this.subscription = this.activeroute.params.subscribe(params => {
                // routing
                this._link = params['url'];
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
            this.urlSafe = this.sanitizer.bypassSecurityTrustResourceUrl(this._link);
        }
    }
}
