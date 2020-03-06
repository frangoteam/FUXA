import { Component, OnInit, ViewContainerRef, ComponentFactoryResolver } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component';
import { GaugeSettings, Variable } from '../../../_models/hmi';
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

    static processValue(ga: GaugeSettings, svgele: any, sig: Variable, gauge?: NgxDygraphsComponent) {
        // console.log(sig);
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
                let options = { interactionModel: {} };    // option to remove interaction in editor modus
                if (isview) {
                    options = null;
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

    static detectChange(gab: GaugeSettings) {
        let ele = document.getElementById(gab.id);
        if (ele) {
            let htmlChart = Utils.searchTreeStartWith(ele, this.prefixD) as HTMLElement;
            let txt = htmlChart.namespaceURI;
        }
    }
}
