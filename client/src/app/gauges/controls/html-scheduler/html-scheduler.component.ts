import { Component, ViewContainerRef, ComponentFactoryResolver, ComponentRef } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component';
import { GaugeSettings, Variable, GaugeStatus } from '../../../_models/hmi';
import { Utils } from '../../../_helpers/utils';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';

import { SchedulerComponent } from '../../../gauges/controls/html-scheduler/scheduler/scheduler.component';

@Component({
    selector: 'html-scheduler',
    templateUrl: './html-scheduler.component.html',
    styleUrls: ['./html-scheduler.component.css']
})
export class HtmlSchedulerComponent extends GaugeBaseComponent {
    static TypeTag = 'svg-ext-own_ctrl-scheduler';
    static LabelTag = 'HtmlScheduler';
    static prefixD = 'D-OXC_';

    constructor() {
        super();
    }

    static getSignals(pro: any) {
        // Forward to the actual scheduler component's getSignals method
        return SchedulerComponent.getSignals(pro);
    }

    static getDialogType(): GaugeDialogType {
        return GaugeDialogType.Scheduler;
    }

    static processValue(ga: GaugeSettings, svgele: any, sig: Variable, gaugeStatus: GaugeStatus, gauge?: SchedulerComponent) {
        if (sig && gauge) {

        }
    }

    static initElement(gab: GaugeSettings, resolver: ComponentFactoryResolver, viewContainerRef: ViewContainerRef, isview: boolean): SchedulerComponent {
        let ele = document.getElementById(gab.id);
        if (ele) {
            ele?.setAttribute('data-name', gab.name);

            // Set default fill color for the scheduler shape
            const rect = ele.querySelector('rect');
            if (rect && !rect.hasAttribute('data-initialized')) {

                if (!rect.getAttribute('fill') || rect.getAttribute('fill') === '#FFFFFF' || rect.getAttribute('fill') === 'rgb(255, 255, 255)') {
                    rect.setAttribute('fill', '#f9f9f9ff');
                }
                rect.setAttribute('data-initialized', 'true');
            }

            let htmlScheduler = Utils.searchTreeStartWith(ele, this.prefixD);
            if (htmlScheduler) {
                const factory = resolver.resolveComponentFactory(SchedulerComponent);
                const componentRef: ComponentRef<SchedulerComponent> = viewContainerRef.createComponent(factory);

                if (!gab.property) {
                    gab.property = {
                        id: null,
                        devices: [],
                        colors: {
                            background: '#ffffff',
                            text: '#000000',
                            accent: '#2196f3',
                            border: '#cccccc'
                        }
                    };
                }

                // Set default color scheme if not already set
                if (!gab.property.accentColor) {
                    gab.property.accentColor = '#556e82'; // RGB(85,110,130) - Theme
                }
                if (!gab.property.backgroundColor) {
                    gab.property.backgroundColor = '#f0f0f0'; // RGB(240,240,240) - Background
                }
                if (!gab.property.borderColor) {
                    gab.property.borderColor = '#cccccc'; // RGB(204,204,204) - Border
                }
                if (!gab.property.textColor) {
                    gab.property.textColor = '#505050'; // RGB(80,80,80) - Primary Text
                }
                if (!gab.property.secondaryTextColor) {
                    gab.property.secondaryTextColor = '#ffffff'; // RGB(255,255,255) - Secondary Text
                }

                htmlScheduler.innerHTML = '';
                componentRef.instance.isEditor = !isview;
                componentRef.instance.property = gab.property;
                componentRef.instance.id = gab.id;

                componentRef.changeDetectorRef.detectChanges();
                htmlScheduler.appendChild(componentRef.location.nativeElement);

                componentRef.instance['myComRef'] = componentRef;
                componentRef.instance['name'] = gab.name;

                return componentRef.instance;
            }
        }
        return null;
    }

    static detectChange(gab: GaugeSettings, res: any, ref: any): SchedulerComponent {
        return HtmlSchedulerComponent.initElement(gab, res, ref, false);
    }
}
