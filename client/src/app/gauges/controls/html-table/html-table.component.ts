import { Component, OnInit, Injectable, ViewContainerRef, ComponentFactoryResolver } from '@angular/core';

import { GaugeSettings, Variable, GaugeStatus } from '../../../_models/hmi';
import { Utils } from '../../../_helpers/utils';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';
import { DataTableComponent } from './data-table/data-table.component';

@Injectable()
export class HtmlTableComponent {
    static TypeTag = 'svg-ext-own_ctrl-table';
    static LabelTag = 'HtmlTable';
    static prefixD = 'D-OXC_';

    static getDialogType(): GaugeDialogType {
        return GaugeDialogType.Table;
    }

    static initElement(gab: GaugeSettings, resolver: ComponentFactoryResolver, viewContainerRef: ViewContainerRef, isview: boolean): DataTableComponent {
        let ele = document.getElementById(gab.id);
        if (ele) {
            let htmlTable = Utils.searchTreeStartWith(ele, this.prefixD);
            if (htmlTable) {
                let factory = resolver.resolveComponentFactory(DataTableComponent);
                const componentRef = viewContainerRef.createComponent(factory);
                // if (gab.property) {
                //     componentRef.instance.withToolbar = (gab.property.type === 'history') ? true : false;
                // }
                htmlTable.innerHTML = '';
                (<DataTableComponent>componentRef.instance).isEditor = !isview;

                // componentRef.instance.rangeType = chartRange;
                (<DataTableComponent>componentRef.instance).id = gab.id;

                componentRef.changeDetectorRef.detectChanges();
                htmlTable.appendChild(componentRef.location.nativeElement);
                // let opt = <GraphOptions>{ panel: { height: htmlGraph.clientHeight, width: htmlGraph.clientWidth } };
                let opt = DataTableComponent.DefaultOptions();
                componentRef.instance.setOptions(opt);

                componentRef.instance['myComRef'] = componentRef;
                return componentRef.instance;
            }
        }
    }

    static detectChange(gab: GaugeSettings, res: any, ref: any): DataTableComponent{
        return HtmlTableComponent.initElement(gab, res, ref, false);
    }    
}
