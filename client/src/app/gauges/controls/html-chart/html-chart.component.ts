import { Component, OnInit, ViewContainerRef, ComponentFactoryResolver } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component';
import { GaugeSettings, Variable, GaugeStatus } from '../../../_models/hmi';
import { Utils } from '../../../_helpers/utils';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';

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

    ngOnInit() { }

    static getSignals(pro: any) {
        return pro.variableIds;
    }

    static getDialogType(): GaugeDialogType {
        return GaugeDialogType.Chart;
    }

    static processValue(ga: GaugeSettings, svgele: any, sig: Variable, gaugeStatus: GaugeStatus, gauge?: NgxDygraphsComponent) {
        gauge.addValue(sig.id, sig.value);
    }

    static initElement(gab: GaugeSettings, resolver: ComponentFactoryResolver, viewContainerRef: ViewContainerRef, isview: boolean, chartRange: any) {
        let ele = document.getElementById(gab.id);
        if (ele) {
            let htmlChart = Utils.searchTreeStartWith(ele, this.prefixD);
            if (htmlChart) {
                const factory = resolver.resolveComponentFactory(NgxDygraphsComponent);
                const componentRef = viewContainerRef.createComponent(factory);
                if (gab.property) {
                    componentRef.instance.withToolbar = (gab.property.type === 'history') ? true : false;
                }
                htmlChart.innerHTML = '';
                let options = {};
                if (!isview) {
                    options = { interactionModel: {} };    // option to remove interaction in editor modus
                }
                if (gab.property && gab.property.options) {
                    options = Object.assign(options, gab.property.options);
                }
                componentRef.instance.defOptions = Object.assign(componentRef.instance.defOptions, options);
                componentRef.instance.isEditor = !isview;

                componentRef.instance.rangeType = chartRange;
                componentRef.instance.id = gab.id;

                componentRef.changeDetectorRef.detectChanges();
                const loaderComponentElement = componentRef.location.nativeElement;
                htmlChart.appendChild(loaderComponentElement);
                componentRef.instance.resize(htmlChart.clientHeight - ((componentRef.instance.withToolbar) ? 34 : 0), htmlChart.clientWidth);
                return componentRef.instance;
            }
        }
    }

    static resize(gab: GaugeSettings, resolver: ComponentFactoryResolver, viewContainerRef: ViewContainerRef, options?: any) {
        let ele = document.getElementById(gab.id);
        if (ele) {
            let htmlChart = Utils.searchTreeStartWith(ele, this.prefixD);
            if (htmlChart) {
                const factory = resolver.resolveComponentFactory(NgxDygraphsComponent);
                const componentRef = viewContainerRef.createComponent(factory);
                htmlChart.innerHTML = '';
                let options = { interactionModel: {} };    // option to remove interaction in editor modus
                if (gab.property) {
                    componentRef.instance.withToolbar = (gab.property.type === 'history') ? true : false;
                    if (gab.property.options) {
                        options = Object.assign(options, gab.property.options);
                    }
                }
                componentRef.instance.defOptions = Object.assign(componentRef.instance.defOptions, options);
                componentRef.instance.isEditor = true;
                componentRef.changeDetectorRef.detectChanges();
                const loaderComponentElement = componentRef.location.nativeElement;
                htmlChart.appendChild(loaderComponentElement);
                componentRef.instance.resize();
                return componentRef.instance;
            }
        }
    }

    static detectChange(gab: GaugeSettings, res: any, ref: any) {
        // return HtmlChartComponent.initElement(gab, res, ref, false, null);
    }
}
