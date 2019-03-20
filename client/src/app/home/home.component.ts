import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { Subscription } from "rxjs/Subscription";

import { HmiService } from '../_services/hmi.service';
import { ProjectService } from '../_services/project.service';
import { GaugesManager } from '../gauges/gauges.component';
import { Hmi, View } from '../_models/hmi';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {

  homeView: View = null;
  hmi: Hmi = new Hmi();

  private subscriptionLoad: Subscription;

  constructor(private projectService: ProjectService,
    private hmiService: HmiService,
    private gaugesManager: GaugesManager) { }

  ngOnInit() {
    this.subscriptionLoad = this.projectService.onLoadHmi.subscribe(res => {
      try {
        this.loadHmi();
      }
      catch (e) {
        console.log(e);
      }
    });
  }

  ngAfterViewInit() {
    try {
      this.loadHmi();
      if (!this.homeView) {
        setTimeout(() => {
          this.loadHmi();
        }, 4000);
      }
    }
    catch (e) {
      console.log(e);
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

  askValue() {
    this.hmiService.askDeviceValues();
  }

  askStatus() {
    this.hmiService.askDeviceStatus();
  }

  private loadHmi() {
    this.hmi = this.projectService.getHmi();
    if (this.hmi && this.hmi.views && this.hmi.views.length > 0) {
      this.homeView = this.hmi.views[0];
    }
  }
}
