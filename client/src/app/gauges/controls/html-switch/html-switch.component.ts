import { Injectable, ViewContainerRef, ComponentFactoryResolver } from '@angular/core';

import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component'
import { GaugeSettings, Variable, GaugeStatus, WindowLink, Event } from '../../../_models/hmi';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';

import { NgxSwitchComponent } from '../../../gui-helpers/ngx-switch/ngx-switch.component';
import { Utils } from '../../../_helpers/utils';

@Injectable()
export class HtmlSwitchComponent {

    static TypeTag = 'svg-ext-html_switch';
    static LabelTag = 'HtmlSwitch';
    static prefix = 'T-HXT_';

    constructor() {
    }

    static getSignals(pro: any) {
        let res: string[] = [];
        if (pro.variableId) {
            res.push(pro.variableId);
        }
        if (pro.alarmId) {
            res.push(pro.alarmId);
        }
        if (pro.actions) {
            pro.actions.forEach(act => {
                res.push(act.variableId);
            });
        }
        return res;
    }

    static getDialogType(): GaugeDialogType {
        return GaugeDialogType.Switch;
    }

    static bindEvents(ga: GaugeSettings, slider?: NgxSwitchComponent, callback?:any): Event {
        if (slider) {
            slider.bindUpdate((val) => {
                let event = new Event();
                event.type = 'on';
                event.ga = ga;
                event.value = val;
                callback(event);
            });
        }
        return null;
    }

    static processValue(ga: GaugeSettings, svgele: any, sig: Variable, gaugeStatus: GaugeStatus, switcher?: NgxSwitchComponent) {
        if (switcher) {
            let val = parseFloat(sig.value);
            if (Number.isNaN(val)) {
                // maybe boolean
                val = Number(sig.value);
            } else {
                val = parseFloat(val.toFixed(5));
            }
            switcher.setValue(val);
        }
    }

    static initElement(ga: GaugeSettings, resolver: ComponentFactoryResolver, viewContainerRef: ViewContainerRef, options?: any) {
        let ele = document.getElementById(ga.id);
        if (ele) {
            let htmlSwitch = Utils.searchTreeStartWith(ele, this.prefix);
            if (htmlSwitch) {
                const factory = resolver.resolveComponentFactory(NgxSwitchComponent);
                const componentRef = viewContainerRef.createComponent(factory);
                htmlSwitch.innerHTML = '';

                componentRef.changeDetectorRef.detectChanges();
                const loaderComponentElement = componentRef.location.nativeElement;
                htmlSwitch.appendChild(loaderComponentElement);
                if (ga.property && ga.property.options) {
                    ga.property.options.height = htmlSwitch.clientHeight;
                    if (!componentRef.instance.setOptions(ga.property.options)) {
                        // componentRef.instance.init();
                    }
                }
                return componentRef.instance;
            }
        }
    }

    static resize(ga: GaugeSettings, resolver: ComponentFactoryResolver, viewContainerRef: ViewContainerRef, options?: any) {
        let ele = document.getElementById(ga.id);
        if (ele) {
            let htmlSwitch = Utils.searchTreeStartWith(ele, this.prefix);
            if (htmlSwitch) {
                const factory = resolver.resolveComponentFactory(NgxSwitchComponent);
                const componentRef = viewContainerRef.createComponent(factory);
                htmlSwitch.innerHTML = '';

                componentRef.changeDetectorRef.detectChanges();
                const loaderComponentElement = componentRef.location.nativeElement;
                htmlSwitch.appendChild(loaderComponentElement);
                if (ga.property && ga.property.options) {
                    ga.property.options.height = htmlSwitch.clientHeight;
                    if (!componentRef.instance.setOptions(ga.property.options, true)) {
                        // componentRef.instance.init();
                    }
                }
                return componentRef.instance;
            }
        }
    }

    static detectChange(ga: GaugeSettings, res: any, ref: any) {
        let options;
        if (ga.property && ga.property.options) {
            options = ga.property.options;
        }
        return HtmlSwitchComponent.initElement(ga, res, ref, options);
    }

    static getSize(ga: GaugeSettings) {
        let result = {height: 0, width: 0};
        let ele = document.getElementById(ga.id);
        if (ele) {
            let htmlSwitch = Utils.searchTreeStartWith(ele, this.prefix);
            if (htmlSwitch) {
                result.height = htmlSwitch.clientHeight;
                result.width = htmlSwitch.clientWidth;
            }
        }
        return result;
    }
}