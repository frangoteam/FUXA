import { Component, ViewContainerRef, ComponentFactoryResolver } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component';
import { GaugeSettings, Variable, GaugeStatus } from '../../../_models/hmi';
import { Utils } from '../../../_helpers/utils';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';
import { GraphBarComponent } from './graph-bar/graph-bar.component';
import { GraphPieComponent } from './graph-pie/graph-pie.component';
import { GraphBaseComponent, GraphOptions } from './graph-base/graph-base.component';


@Component({
    selector: 'html-graph',
    templateUrl: './html-graph.component.html',
    styleUrls: ['./html-graph.component.css']
})
export class HtmlGraphComponent extends GaugeBaseComponent {
    static TypeTag = 'svg-ext-html_graph';
    static LabelTag = 'HtmlGraph';
    static prefixD = 'D-HXC_';
    static suffixPie = '-pie';
    static suffixBar = '-bar';

    constructor() {
        super();
    }

    static getSignals(pro: any) {
        return pro.variableIds;
    }

    static getDialogType(): GaugeDialogType {
        return GaugeDialogType.Graph;
    }

    static processValue(ga: GaugeSettings, svgele: any, sig: Variable, gaugeStatus: GaugeStatus, gauge?: any) {
        try {
            if (gauge && !gauge.isOffline()) {
                gauge.setValue(sig.id, new Date().getTime() / 1000, sig.value);
            }
        } catch (err) {
            console.error(err);
        }
    }

    static initElement(gab: GaugeSettings, resolver: ComponentFactoryResolver, viewContainerRef: ViewContainerRef, isview: boolean): GraphBaseComponent {
        let ele = document.getElementById(gab.id);
        if (ele) {
            ele?.setAttribute('data-name', gab.name);
            let htmlGraph = Utils.searchTreeStartWith(ele, this.prefixD);
            if (htmlGraph) {
                let factory = resolver.resolveComponentFactory(GraphBaseComponent);
                if (gab.type.endsWith(this.suffixBar)) {
                    factory = resolver.resolveComponentFactory(GraphBarComponent);
                } else {
                    factory = resolver.resolveComponentFactory(GraphPieComponent);
                }
                const componentRef = viewContainerRef.createComponent(factory);
                // if (gab.property) {
                //     componentRef.instance.withToolbar = (gab.property.type === 'history') ? true : false;
                // }
                htmlGraph.innerHTML = '';
                (<GraphBaseComponent>componentRef.instance).isEditor = !isview;

                // componentRef.instance.rangeType = chartRange;
                (<GraphBaseComponent>componentRef.instance).id = gab.id;

                componentRef.changeDetectorRef.detectChanges();
                htmlGraph.appendChild(componentRef.location.nativeElement);
                let opt = <GraphOptions>{ panel: { height: htmlGraph.clientHeight, width: htmlGraph.clientWidth } };
                if (gab.type.endsWith(this.suffixBar)) {
                    opt = { ...GraphBarComponent.DefaultOptions(), ...opt };
                } else {
                    opt = { ...GraphPieComponent.DefaultOptions(), ...opt };
                }
                componentRef.instance.setOptions(opt);
                if (gab.property?.options?.backgroundColor) {
                    window['svgEditor']?.setColor(gab.property.options.backgroundColor, 100, 'fill');
                } else {
                    window['svgEditor']?.setColor('none', 100, 'fill');
                }

                componentRef.instance['myComRef'] = componentRef;
                componentRef.instance['name'] = gab.name;
                return componentRef.instance;
            }
        }
    }

    static detectChange(gab: GaugeSettings, res: any, ref: any) {
        return HtmlGraphComponent.initElement(gab, res, ref, false);
    }
}
