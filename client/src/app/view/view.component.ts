import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ChangeDetectorRef } from '@angular/core';
import { Subscription } from "rxjs";
import { ActivatedRoute } from '@angular/router';

import { ProjectService } from '../_services/project.service';
import { Hmi, View } from '../_models/hmi';
import { GaugesManager } from '../gauges/gauges.component';
import { FuxaViewComponent } from '../fuxa-view/fuxa-view.component';

@Component({
  selector: 'app-view',
  templateUrl: './view.component.html',
  styleUrls: ['./view.component.css']
})
export class ViewComponent implements OnInit, AfterViewInit, OnDestroy {

    @ViewChild('fuxaview') fuxaview: FuxaViewComponent;

    startView: View = new View();
    hmi: Hmi = new Hmi();

    private viewName: string;

    private subscriptionLoad: Subscription;

    constructor(private projectService: ProjectService,
        private route: ActivatedRoute,
        private changeDetector: ChangeDetectorRef,
        public gaugesManager: GaugesManager) { }

    ngOnInit() {
        this.viewName = this.route.snapshot.queryParamMap.get('name');
    }

    ngAfterViewInit() {
        try {
            let hmi = this.projectService.getHmi();
            if (hmi) {
                this.loadHmi();
            }
            this.subscriptionLoad = this.projectService.onLoadHmi.subscribe(load => {
                this.loadHmi();
            }, error => {
                console.log('Error loadHMI');
            });
            this.changeDetector.detectChanges();
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

    private loadHmi() {
        let hmi = this.projectService.getHmi();
        if (hmi) {
            this.hmi = hmi;
        }
        if (this.hmi && this.hmi.views && this.hmi.views.length > 0) {
            this.startView = this.hmi.views.find(x => x.name === this.viewName);
            this.setBackground();
            if (this.startView && this.fuxaview) {
                this.fuxaview.loadHmi(this.startView);
            }
        }
    }

    private setBackground() {
		if (this.startView && this.startView.profile) {
			document.getElementById("main-container").style.backgroundColor = this.startView.profile.bkcolor;
		}
	}
}
