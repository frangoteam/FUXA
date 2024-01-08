import { Injectable, ViewContainerRef, ComponentFactoryResolver } from '@angular/core';

import { GaugeSettings, Variable, GaugeStatus, TableType, TableOptions, TableCellType, GaugeTableProperty } from '../../../_models/hmi';
import { Utils } from '../../../_helpers/utils';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';
import { DataTableComponent } from './data-table/data-table.component';

@Injectable()
export class HtmlTableComponent {
    static TypeTag = 'svg-ext-own_ctrl-table';
    static LabelTag = 'HtmlTable';
    static prefixD = 'D-OXC_';

    static getSignals(pro: ITableProperty): string[] {
        if (pro.type === TableType.data && pro.options && pro.options.rows) {
            let signalIds = [];
            pro.options.rows.forEach(row => {
                row.cells.forEach(cell => {
                    if (cell && cell.variableId && cell.type === TableCellType.variable) {
                        signalIds.push(cell.variableId);
                    }
                });
            });
            return signalIds;
        }
        return null;
    }

    static getDialogType(): GaugeDialogType {
        return GaugeDialogType.Table;
    }

    static processValue(ga: GaugeSettings, svgele: any, sig: Variable, gaugeStatus: GaugeStatus, gauge?: DataTableComponent) {
        try {
            gauge.addValue(sig.id, (sig.timestamp || new Date().getTime()) / 1000, sig.value);
        } catch (err) {
            console.error(err);
        }
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
                if (!gab.property) {
                    gab.property = <GaugeTableProperty>{ id: null, type: TableType.data, options: DataTableComponent.DefaultOptions() };
                }
                htmlTable.innerHTML = '';
                (<DataTableComponent>componentRef.instance).isEditor = !isview;

                // componentRef.instance.rangeType = chartRange;
                (<DataTableComponent>componentRef.instance).id = gab.id;
                (<DataTableComponent>componentRef.instance).type = gab.property.type;

                componentRef.changeDetectorRef.detectChanges();
                htmlTable.appendChild(componentRef.location.nativeElement);
                // let opt = <GraphOptions>{ panel: { height: htmlGraph.clientHeight, width: htmlGraph.clientWidth } };
                let opt = DataTableComponent.DefaultOptions();
                // componentRef.instance.setOptions(opt);

                componentRef.instance['myComRef'] = componentRef;
                return componentRef.instance;
            }
        }
    }

    static detectChange(gab: GaugeSettings, res: any, ref: any): DataTableComponent{
        return HtmlTableComponent.initElement(gab, res, ref, false);
    }
}

interface ITableProperty {
    type: TableType;
    options: TableOptions;
}
