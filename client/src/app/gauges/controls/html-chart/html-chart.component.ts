import { Component, OnInit, ViewContainerRef, ComponentFactoryResolver } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component';
import { GaugeSettings } from '../../../_models/hmi';
import { Utils } from '../../../_helpers/utils';

import { NgxDygraphsComponent } from '../../../gui-helpers/ngx-dygraphs/ngx-dygraphs.component';

@Component({
  selector: "html-chart",
  templateUrl: "./html-chart.component.html",
  styleUrls: ["./html-chart.component.css"]
})
export class HtmlChartComponent extends GaugeBaseComponent implements OnInit {
  static TypeTag = "svg-ext-html_chart";
  static LabelTag = "HtmlChart";
  static prefixD = "D-HXC_";

  constructor(private resolver: ComponentFactoryResolver) {
    super();
  }

  ngOnInit() {}

  static initElement(gab: GaugeSettings, resolver: ComponentFactoryResolver, viewContainerRef: ViewContainerRef, options: any) {
    let ele = document.getElementById(gab.id);
    if (ele) {
      let htmlChart = Utils.searchTreeStartWith(ele, this.prefixD);
      if (htmlChart) {
        const factory = resolver.resolveComponentFactory(NgxDygraphsComponent);
        const componentRef = viewContainerRef.createComponent(factory);
        if (options) {
          componentRef.instance.defOptions = Object.assign(componentRef.instance.defOptions, options);
        }
        componentRef.changeDetectorRef.detectChanges();
        const loaderComponentElement = componentRef.location.nativeElement;
        const sibling: HTMLElement = loaderComponentElement.previousSibling;
        htmlChart.appendChild(loaderComponentElement);
          componentRef.instance.resize(htmlChart.clientHeight, htmlChart.clientWidth);
          return componentRef.instance;
      }
    }
  }
}
