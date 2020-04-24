import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ViewContainerRef, ChangeDetectorRef  } from '@angular/core';
import { Subscription } from "rxjs";

import { ProjectService } from '../_services/project.service';
import { Hmi, View, GaugeSettings } from '../_models/hmi';
import { GaugesManager } from '../gauges/gauges.component';
import { TesterService } from '../tester/tester.service';
import { TesterComponent } from '../tester/tester.component';

declare var SVG: any;
declare var Raphael: any;

@Component({
    moduleId: module.id,
    templateUrl: 'lab.component.html',
    styleUrls: ['lab.component.css']
})

export class LabComponent implements OnInit, AfterViewInit, OnDestroy {

    @ViewChild('messagecontainer', { read: ViewContainerRef }) entry: ViewContainerRef;
    @ViewChild('tester') tester: TesterComponent;

    isLoading = true;
    currentView: View = new View();
    hmi: Hmi = new Hmi();
    svgMain: any;
    componentRef: any;
    labView: View = null;
	backgroudColor = 'unset';

	private subscriptionLoad: Subscription;

    constructor(private projectService: ProjectService,
        private gaugesManager: GaugesManager,
        private changeDetector: ChangeDetectorRef,        
        private testerService: TesterService) {
    }

    ngOnInit() {

    }

    ngAfterViewInit() {
        try {
            let hmi = this.projectService.getHmi();
            if (!hmi) {
                this.subscriptionLoad = this.projectService.onLoadHmi.subscribe(load => {
                    this.loadHmi();
                }, error => {
                    console.log('Error loadHMI');
                });
            } else {
                this.loadHmi();
            }
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

    onTest() {
        this.tester.setSignals(this.gaugesManager.getMappedGaugesSignals(true));
        this.testerService.toggle(true);
    }

    private loadHmi() {
        this.hmi = this.projectService.getHmi();
        if (this.hmi && this.hmi.views && this.hmi.views.length > 0) {
            this.currentView = this.hmi.views[0];
            this.labView = this.hmi.views[0];
            let oldsel = localStorage.getItem("@frango.webeditor.currentview");
            if (oldsel) {
                for (let i = 0; i < this.hmi.views.length; i++) {
                    if (this.hmi.views[i].name === oldsel) {
                        this.currentView = this.hmi.views[i];
                        this.setBackground();
                        break;
                    }
                }
            }
        }
        this.isLoading = false;
    }

    private setBackground() {
		if (this.currentView && this.currentView.profile) {
			this.backgroudColor = this.currentView.profile.bkcolor;
		}
	}
}
