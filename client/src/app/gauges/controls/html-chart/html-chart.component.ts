import { Component, OnInit, ViewContainerRef, ComponentFactoryResolver } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component';
import { GaugeSettings, Variable, GaugeStatus } from '../../../_models/hmi';
import { Utils } from '../../../_helpers/utils';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';

import { ChartUplotComponent, ChartOptions } from './chart-uplot/chart-uplot.component';

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

    static processValue(ga: GaugeSettings, svgele: any, sig: Variable, gaugeStatus: GaugeStatus, gauge?: ChartUplotComponent) {
        try {
            gauge.addValue(sig.id, new Date().getTime() / 1000, sig.value);
        } catch (err) {
            console.error(err);
        }
    }

    static initElement(gab: GaugeSettings, resolver: ComponentFactoryResolver, viewContainerRef: ViewContainerRef, isview: boolean, chartRange: any) {
        let ele = document.getElementById(gab.id);
        if (ele) {
            let htmlChart = Utils.searchTreeStartWith(ele, this.prefixD);
            if (htmlChart) {
                const factory = resolver.resolveComponentFactory(ChartUplotComponent);
                const componentRef = viewContainerRef.createComponent(factory);
                if (gab.property) {
                    componentRef.instance.withToolbar = (gab.property.type === 'history') ? true : false;
                }
                htmlChart.innerHTML = '';
                componentRef.instance.isEditor = !isview;

                componentRef.instance.rangeType = chartRange;
                componentRef.instance.id = gab.id;

                componentRef.changeDetectorRef.detectChanges();
                htmlChart.appendChild(componentRef.location.nativeElement);
                let opt = <ChartOptions>{ title: '', panel: { height: htmlChart.clientHeight, width: htmlChart.clientWidth } };
                componentRef.instance.setOptions(opt);

                componentRef.instance['myComRef'] = componentRef;
                return componentRef.instance;
            }
        }
    }

    static detectChange(gab: GaugeSettings, res: any, ref: any) {
        return HtmlChartComponent.initElement(gab, res, ref, false, null);
    }
}
