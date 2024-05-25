import { Component, ComponentFactoryResolver, ViewContainerRef } from '@angular/core';
import { GaugeActionsType, GaugeSettings, GaugeStatus, Hmi, Variable } from '../../../_models/hmi';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';
import { Utils } from '../../../_helpers/utils';
import { FuxaViewComponent } from '../../../fuxa-view/fuxa-view.component';
import { GaugesManager } from '../../gauges.component';
import { ProjectService } from '../../../_services/project.service';

@Component({
    selector: 'app-panel',
    templateUrl: './panel.component.html',
    styleUrls: ['./panel.component.css']
})
export class PanelComponent extends GaugeBaseComponent {
    static TypeTag = 'svg-ext-own_ctrl-panel';
    static LabelTag = 'Panel';
    static prefixD = 'D-OXC_';

    static actionsType = { hide: GaugeActionsType.hide, show: GaugeActionsType.show };
    static hmi: Hmi;

    constructor(private projectService: ProjectService) {
        super();
    }

    static getSignals(pro: any) {
        let res: string[] = [];
        if (pro.variableId) {
            res.push(pro.variableId);
        }
        return res;
    }

    static getDialogType(): GaugeDialogType {
        return GaugeDialogType.Panel;
    }

    static processValue(ga: GaugeSettings, svgele: any, sig: Variable, gaugeStatus: GaugeStatus, gauge?: FuxaViewComponent) {
        try {
            const view = PanelComponent.hmi.views.find(x => x.name === sig.value);
            if (view) {
                gauge?.loadHmi(view, true);
                if (ga?.property?.scaleMode) {
                    Utils.resizeViewExt('.view-container', ga?.id, ga?.property?.scaleMode);
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    static initElement(gaugeSettings: GaugeSettings,
                       resolver: ComponentFactoryResolver,
                       viewContainerRef: ViewContainerRef,
                       gaugeManager: GaugesManager,
                       hmi: Hmi,
                       isview?: boolean,
                       parent?: FuxaViewComponent): FuxaViewComponent {
        if (hmi) {
            PanelComponent.hmi = hmi;
        }
        let ele = document.getElementById(gaugeSettings.id);
        if (ele) {
            ele?.setAttribute('data-name', gaugeSettings.name);
            let svgPanelContainer = Utils.searchTreeStartWith(ele, this.prefixD);
            if (svgPanelContainer) {
                const factory = resolver.resolveComponentFactory(FuxaViewComponent);
                const componentRef = viewContainerRef.createComponent(factory);
                componentRef.instance.gaugesManager = gaugeManager;

                componentRef.changeDetectorRef.detectChanges();
                const loaderComponentElement = componentRef.location.nativeElement;
                svgPanelContainer.innerHTML = '';
                svgPanelContainer.appendChild(loaderComponentElement);

                componentRef.instance['myComRef'] = componentRef;
                componentRef.instance.parent = parent;
                if (!isview) {
                    let span = document.createElement('span');
                    span.innerHTML = 'Panel';
                    svgPanelContainer.appendChild(span);
                    return null;
                }
                PanelComponent.processValue(gaugeSettings,
                                            null,
                                            <Variable> {
                                                value: gaugeSettings.property.viewName
                                            },
                                            null,
                                            componentRef.instance);
                componentRef.instance['name'] = gaugeSettings.name;
                return componentRef.instance;
            }
        }
    }
}
