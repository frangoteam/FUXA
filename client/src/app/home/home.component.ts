import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild } from '@angular/core';
import { Subscription } from "rxjs/Subscription";
import { MatSidenav } from '@angular/material';
import { Router } from '@angular/router';

import { SidenavComponent } from '../sidenav/sidenav.component';
import { FuxaViewComponent } from '../fuxa-view/fuxa-view.component';
import { IframeComponent } from '../iframe/iframe.component';

import { HmiService } from '../_services/hmi.service';
import { ProjectService } from '../_services/project.service';
import { GaugesManager } from '../gauges/gauges.component';
import { Hmi, View, NaviModeType } from '../_models/hmi';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('sidenav') sidenav: SidenavComponent;
  @ViewChild('matsidenav') matsidenav: MatSidenav;
  @ViewChild('fuxaview') fuxaview: FuxaViewComponent;
  // @ViewChild('iframeview') iframeview: IframeComponent;

  homeView: View = new View();
  hmi: Hmi = new Hmi();
  showSidenav = 'over';
  showHomeView = false;
  homeLink = '';
  showHomeLink = false;

  private subscriptionLoad: Subscription;

  constructor(private projectService: ProjectService,
    private router: Router,
    private hmiService: HmiService,
    private gaugesManager: GaugesManager) { }

  ngOnInit() {
    try {
      this.subscriptionLoad = this.projectService.onLoadHmi.subscribe(res => {
        try {
          this.loadHmi();
        }
        catch (e) {
          console.log(e);
        }
      });
    }
    catch (e) {
      console.log(e);
    }
  }

  ngAfterViewInit() {
    try {
      // this.subscriptionLoad = this.projectService.onLoadHmi.subscribe(res => {
      //   try {
      //     this.loadHmi();
      //   }
      //   catch (e) {
      //     console.log(e);
      //   }
      // });
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

  onGoToPage(event: string) {
    const view = this.hmi.views.find(x => x.id === event);
    if (view) {
      this.homeView = view;
      this.fuxaview.loadHmi(this.homeView);
    }
    this.showHomeLink = false;
    this.showHomeView = (this.homeView) ? true : false;
  }

  onGoToLink(event: string) {
    if (event.indexOf('://') >= 0) {
      // this.showHomeView = false;
      // this.showHomeLink = true;
      // this.iframeview.loadLink(event);

    } else {
      this.router.navigate([event]).then(data => {
        console.log('Route ' + event + ' exists, redirection is done');
      }).catch(e => {
        console.log('Route ' + event + '  not found, redirection stopped with no error raised');
        // try iframe link
      });
    }
    console.log(event);
  }

  askValue() {
    this.hmiService.askDeviceValues();
  }

  askStatus() {
    this.hmiService.askDeviceStatus();
  }

  private loadHmi() {
    let hmi = this.projectService.getHmi();
    if (hmi) {
      this.hmi = hmi;
    }
    if (this.hmi && this.hmi.views && this.hmi.views.length > 0) {
      if (this.hmi.layout.start) {
        const startView = this.hmi.views.find(x => x.id === this.hmi.layout.start);
        if (startView) {
          this.homeView = startView;
        }
      } else {
        this.homeView = this.hmi.views[0];
      }
      // check sidenav
      let nvoid = NaviModeType[this.hmi.layout.navigation.mode];
      if (this.hmi.layout && nvoid !== NaviModeType.void) {
        if (nvoid === NaviModeType.over) {
          this.showSidenav = 'over';
        } else if (nvoid === NaviModeType.fix) {
          this.showSidenav = 'side';
          this.matsidenav.open();
        } else if (nvoid === NaviModeType.push) {
          this.showSidenav = 'push';
        }
        this.sidenav.setLayout(this.hmi.layout);
      } else {
        this.showSidenav = null;
      }
    }
    this.showHomeView =  (this.homeView) ? true : false;
    if (this.homeView && this.fuxaview) {
        this.fuxaview.loadHmi(this.homeView);
    }
  }
}
