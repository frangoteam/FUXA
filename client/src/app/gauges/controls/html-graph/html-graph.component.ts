import { Component, OnInit, ViewContainerRef, ComponentFactoryResolver } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component';
import { GaugeSettings, Variable, GaugeStatus } from '../../../_models/hmi';
import { Utils } from '../../../_helpers/utils';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';
import { GraphBarComponent } from './graph-bar/graph-bar.component';
import { GraphPieComponent } from './graph-pie/graph-pie.component';


@Component({
    selector: "html-graph",
    templateUrl: "./html-graph.component.html",
    styleUrls: ["./html-graph.component.css"]
})
export class HtmlGraphComponent extends GaugeBaseComponent implements OnInit {
    static TypeTag = 'svg-ext-html_graph';
    static LabelTag = 'HtmlGraph';
    static prefixD = 'D-HXC_';
    static suffixPie = '-pie';
    static suffixBar = '-bar';

    constructor() {
        super();
    }

    ngOnInit() {
    }

    static getSignals(pro: any) {
        return pro.variableIds;
    }

    static getDialogType(): GaugeDialogType {
        return GaugeDialogType.Chart;
    }

    static processValue(ga: GaugeSettings, svgele: any, sig: Variable, gaugeStatus: GaugeStatus, gauge?: any) {
    }

    static initElement(gab: GaugeSettings, resolver: ComponentFactoryResolver, viewContainerRef: ViewContainerRef, isview: boolean) {
        let ele = document.getElementById(gab.id);
        if (ele) {
            let htmlChart = Utils.searchTreeStartWith(ele, this.prefixD);
            if (htmlChart) {
                var factory;
                if (gab.type.endsWith(this.suffixBar)) {
                    factory = resolver.resolveComponentFactory(GraphBarComponent);
                } else {
                    factory = resolver.resolveComponentFactory(GraphPieComponent);
                }
                const componentRef = viewContainerRef.createComponent(factory);
                // if (gab.property) {
                //     componentRef.instance.withToolbar = (gab.property.type === 'history') ? true : false;
                // }
                htmlChart.innerHTML = '';
                // componentRef.instance.isEditor = !isview;

                // componentRef.instance.rangeType = chartRange;
                // componentRef.instance.id = gab.id;

                componentRef.changeDetectorRef.detectChanges();
                htmlChart.appendChild(componentRef.location.nativeElement);
                // let opt = <ChartOptions>{ title: '', panel: { height: htmlChart.clientHeight, width: htmlChart.clientWidth } };
                // componentRef.instance.setOptions(opt);

                componentRef.instance['myComRef'] = componentRef;
                return componentRef.instance;
            }
        }
    }

    static detectChange(gab: GaugeSettings, res: any, ref: any) {
        return HtmlGraphComponent.initElement(gab, res, ref, false);
    }
}
