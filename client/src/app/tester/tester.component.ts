import { Component, OnInit } from '@angular/core';
import { GaugesManager } from '../gauges/gauges.component';
import { Subscription } from "rxjs";
import { Observable } from 'rxjs/Rx';

import { HmiService } from '../_services/hmi.service';
import { TesterService } from '../tester/tester.service';
import { GaugeSettings, Variable } from '../_models/hmi';


@Component({
  selector: 'app-tester',
  templateUrl: './tester.component.html',
  styleUrls: ['./tester.component.css']
})
export class TesterComponent implements OnInit {

  show: boolean = false;
  items: Variable[] = [];
  output: string[] = [];
  subscription: Subscription;
  demoSwitch = true;

  // items: Map<string, GaugeSettings> = new Map<string, GaugeSettings>();


  constructor(private hmiService: HmiService, private gaugesManager: GaugesManager,
    private testerService: TesterService) { }

  ngOnInit() {
    this.testerService.change.subscribe(isOpen => {
      this.show = isOpen;
    });

    this.gaugesManager.onevent.subscribe(event => {
      if (event.dbg) {
        this.addOutput(event.dbg);
      }
    });
  }

  ngOnDestroy() {
    console.log('Tester destroy');
    this.stopDemo();
  }

  setSignal(sig:any) {
    this.hmiService.setSignalValue(sig);
    this.addOutput('set ' + sig.id + ' ' + sig.value);
  }

  setSignals(items: any) {
    this.items = items;
    // let gauges: GaugeSettings[] = [];
    // Object.entries(items).forEach(([key, value]) => {
    //     console.log(key, value);
    //     gauges.push(<GaugeSettings>value);
    //   }
    // );
    // let vars = this.gaugesManager.getSignals(gauges);
    // if (vars && vars.length > 0) {
    //   this.items = vars;
    // }
    // console.log(this.items);
  }

  setDemo(flag) {
    console.log('set demo' + flag);
    if (flag) {
      // this.gaugesManager.startDemo();
    } else {
      // this.gaugesManager.stopDemo();
    }
  }

  addOutput(item: string) {
    this.output.push(item);
  }

  close() {
    this.testerService.toggle(false);
  }

  startDemo() {
    this.stopDemo();
    let timer = Observable.timer(2000, 1500);
    this.subscription = timer.subscribe(t => {
      this.demoValue();
    });
  }

  stopDemo() {
    try {
      if (this.subscription) {
        this.subscription.unsubscribe();
      }
    } catch (e) {

    }
  }

  demoValue() {
    // this.demoSwitch = (this.demoSwitch) ? false : true;
    // for (let i = 0; i < this.signals.length; i++) {
    //   if (this.demoSwitch && i % 2) {
    //     continue;
    //   }
    //   if (this.signals[i].type === 'analog') {
    //     this.signals[i].value = Number(this.randomRange(-10, 100)).toFixed(2);
    //   } else if (this.signals[i].type === 'digital') {
    //     this.signals[i].value = (Math.random() > 0.5) ? '1' : '0'; // Number(this.randomRange(0, 0.99)).toFixed(0);
    //   }
    //   this.setSignalValue(this.signals[i]);
    //   console.log('set sig ' + this.signals[i].name + ' ' + this.signals[i].value);
    // }
  }
}
