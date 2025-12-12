import { Injectable, ViewContainerRef, ComponentFactoryResolver } from '@angular/core';

import { GaugeSettings, Variable, GaugeStatus, TableType, TableOptions, TableCellType, GaugeTableProperty } from '../../../_models/hmi';
import { Utils } from '../../../_helpers/utils';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';
import { DataTableComponent } from './data-table/data-table.component';
import { ParameterTableComponent } from './parameter-table/parameter-table.component';
import { AlarmsFilter } from '../../../_models/alarm';
import { ReportsFilter } from '../../../_models/report';

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

    static initElement(gab: GaugeSettings, resolver: ComponentFactoryResolver, viewContainerRef: ViewContainerRef, isview: boolean): DataTableComponent | ParameterTableComponent {
        let ele = document.getElementById(gab.id);
        if (ele) {
            ele?.setAttribute('data-name', gab.name);
            let htmlTable = Utils.searchTreeStartWith(ele, this.prefixD);
            if (htmlTable) {
                let componentRef: any;

                if (gab.property?.type === TableType.parameter) {
                    // Create Parameter Table Component
                    let factory = resolver.resolveComponentFactory(ParameterTableComponent);
                    componentRef = viewContainerRef.createComponent(factory);
                } else {
                    // Create Data Table Component for other types
                    let factory = resolver.resolveComponentFactory(DataTableComponent);
                    componentRef = viewContainerRef.createComponent(factory);
                }

                if (!gab.property) {
                    gab.property = <GaugeTableProperty>{
                        id: null,
                        type: TableType.data,
                        options: DataTableComponent.DefaultOptions(),
                        events: []
                    };
                }
                htmlTable.innerHTML = '';
                componentRef.instance.isEditor = !isview;

                componentRef.instance.id = gab.id;
                componentRef.instance.type = gab.property.type;
                componentRef.instance.events = gab.property.events;
                if (gab.property?.type === TableType.parameter) {
                    componentRef.instance.property = gab.property;  // Set the property for parameter-table
                }
                componentRef.instance.dataFilter = null;
                if (gab.property.type === TableType.alarms && gab.property.options?.alarmFilter) {
                    const dataFilter = <AlarmsFilter> {
                        priority: gab.property.options?.alarmFilter?.filterA,
                        text: gab.property.options?.alarmFilter?.filterB[0],
                        group: gab.property.options?.alarmFilter?.filterB[1],
                        tagIds: gab.property.options?.alarmFilter?.filterC
                    };
                    componentRef.instance.dataFilter = dataFilter;
                } else if (gab.property.type === TableType.reports && gab.property.options?.reportFilter) {
                    const dataFilter = <ReportsFilter> {
                        name: gab.property.options?.reportFilter?.filterA[0],
                        count: gab.property.options?.reportFilter?.filterA[1],
                    };
                    componentRef.instance.dataFilter = dataFilter;
                }
                componentRef.changeDetectorRef.detectChanges();
                htmlTable.appendChild(componentRef.location.nativeElement);
                // Pass table options to component
                if (gab.property.options) {
                    componentRef.instance.setOptions(gab.property.options);
                }

                componentRef.instance['myComRef'] = componentRef;
                componentRef.instance['name'] = gab.name;
                return componentRef.instance;
            }
        }
    }

    static detectChange(gab: GaugeSettings, res: any, ref: any): DataTableComponent | ParameterTableComponent{
        return HtmlTableComponent.initElement(gab, res, ref, false);
    }
}

interface ITableProperty {
    type: TableType;
    options: TableOptions;
}
