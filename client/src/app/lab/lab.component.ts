import { Component, OnInit } from '@angular/core';
import { ViewChild } from '@angular/core';
import { ViewContainerRef } from '@angular/core';

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

export class LabComponent implements OnInit {

    currentView: View = null;
    hmi: Hmi = new Hmi();
    svgMain: any;
    componentRef: any;

    @ViewChild('messagecontainer', { read: ViewContainerRef }) entry: ViewContainerRef;
    @ViewChild('tester') tester: TesterComponent;

    constructor(private projectService: ProjectService,
        private gaugesManager: GaugesManager,
        private testerService: TesterService) {
    }

    ngOnInit() {
        try {
            // this.gaugesManager.stopDemo();
            this.loadHmi();

            // this.gaugesManager.startDemo();
        }
        catch (e) {
            console.log(e);
        }
    }

    onTest() {
        this.tester.setSignals(this.gaugesManager.getMappedGaugesSignals());
        this.testerService.toggle(true);
    }

    private loadHmi() {
        this.hmi = this.projectService.getHmi();
        if (this.hmi && this.hmi.views && this.hmi.views.length > 0) {
            this.currentView = this.hmi.views[0];
            let oldsel = localStorage.getItem("@frango.webeditor.currentview");
            if (oldsel) {
                for (let i = 0; i < this.hmi.views.length; i++) {
                    if (this.hmi.views[i].name === oldsel) {
                        this.currentView = this.hmi.views[i];
                        break;
                    }
                }
            }
            // this.dataContainer.nativeElement.innerHTML = this.currentView.svgcontent;
        }
    }
}
