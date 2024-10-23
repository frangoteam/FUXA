import { Injectable, ViewContainerRef, ComponentFactoryResolver } from '@angular/core';

import { GaugeSettings, Variable, GaugeStatus, TableType, TableOptions, TableCellType, GaugeTableProperty } from '../../../_models/hmi';
import { Utils } from '../../../_helpers/utils';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';
import { DataTableComponent } from './data-table/data-table.component';
import { AlarmsFilter } from '../../../_models/alarm';

@Injectable()
export class HtmlTableComponent {
    static TypeTag = 'svg-ext-own_ctrl-table';
    static LabelTag = 'HtmlTable';
    static prefixD = 'D-OXC_';

    static getSignals(pro: ITableProperty): string[] {
        if (pro.type === TableType.data && pro.options?.rows) {
            let signalIds = [];
            pro.options.rows.forEach(row => {
                row.cells.forEach(cell => {
                    if (cell && cell.variableId && cell.type === TableCellType.variable) {
                        signalIds.push(cell.variableId);
                    }
                });
            });
            return signalIds;
        } else if (pro.options?.realtime) {
            let signalIds = [];
            pro.options.columns?.forEach(col => {
                if (col.variableId && col.type === TableCellType.variable) {
                        signalIds.push(col.variableId);
                }
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
            ele?.setAttribute('data-name', gab.name);
            let htmlTable = Utils.searchTreeStartWith(ele, this.prefixD);
            if (htmlTable) {
                let factory = resolver.resolveComponentFactory(DataTableComponent);
                const componentRef = viewContainerRef.createComponent(factory);
                // if (gab.property) {
                //     componentRef.instance.withToolbar = (gab.property.type === 'history') ? true : false;
                // }
                if (!gab.property) {
                    gab.property = <GaugeTableProperty>{
                        id: null,
                        type: TableType.data,
                        options: DataTableComponent.DefaultOptions(),
                        events: []
                    };
                }
                htmlTable.innerHTML = '';
                (<DataTableComponent>componentRef.instance).isEditor = !isview;

                // componentRef.instance.rangeType = chartRange;
                (<DataTableComponent>componentRef.instance).id = gab.id;
                (<DataTableComponent>componentRef.instance).type = gab.property.type;
                (<DataTableComponent>componentRef.instance).events = gab.property.events;
                (<DataTableComponent>componentRef.instance).dataFilter = gab.property.options?.alarmFilter;
                if (gab.property.type === TableType.alarms && gab.property.options?.alarmFilter) {
                    const dataFilter = <AlarmsFilter> {
                        priority: gab.property.options?.alarmFilter?.filterA,
                        text: gab.property.options?.alarmFilter?.filterB[0],
                        group: gab.property.options?.alarmFilter?.filterB[1],
                        tagIds: gab.property.options?.alarmFilter?.filterC
                    };
                    (<DataTableComponent>componentRef.instance).dataFilter = dataFilter;
                }
                componentRef.changeDetectorRef.detectChanges();
                htmlTable.appendChild(componentRef.location.nativeElement);
                // let opt = <GraphOptions>{ panel: { height: htmlGraph.clientHeight, width: htmlGraph.clientWidth } };
                let opt = DataTableComponent.DefaultOptions();
                // componentRef.instance.setOptions(opt);

                componentRef.instance['myComRef'] = componentRef;
                componentRef.instance['name'] = gab.name;
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
