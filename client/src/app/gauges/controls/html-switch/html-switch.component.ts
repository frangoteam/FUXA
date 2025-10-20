import { Injectable, ViewContainerRef, ComponentFactoryResolver } from '@angular/core';

import { GaugeSettings, Variable, GaugeStatus, Event, GaugeProperty } from '../../../_models/hmi';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';

import { NgxSwitchComponent } from '../../../gui-helpers/ngx-switch/ngx-switch.component';
import { Utils } from '../../../_helpers/utils';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component';
import { CheckPermissionFunction } from '../../../_services/auth.service';

@Injectable()
export class HtmlSwitchComponent extends GaugeBaseComponent {

    static TypeTag = 'svg-ext-html_switch';
    static LabelTag = 'HtmlSwitch';
    static prefix = 'T-HXT_';

    constructor() {
        super();
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

    static isBitmaskSupported(): boolean {
        return true;
    }

    static bindEvents(ga: GaugeSettings, slider?: NgxSwitchComponent, callback?: any): Event {
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
        try {
            if (switcher) {
                let value = parseFloat(sig.value);
                if (Number.isNaN(value)) {
                    // maybe boolean
                    value = Number(sig.value);
                } else {
                    value = parseFloat(value.toFixed(5));
                }
                if (typeof sig.value !== 'boolean') {
                    value = GaugeBaseComponent.checkBitmaskAndValue((<GaugeProperty>ga.property).bitmask,
                                                                            value,
                                                                            (<GaugeProperty>ga.property).options.offValue,
                                                                            (<GaugeProperty>ga.property).options.onValue);
                }
                switcher.setValue(value);
            }
        } catch (err) {
            console.error(err);
        }
    }

    static initElement(ga: GaugeSettings, resolver: ComponentFactoryResolver, viewContainerRef: ViewContainerRef, checkPermission?: CheckPermissionFunction) {
        let ele = document.getElementById(ga.id);
        if (ele) {
            ele?.setAttribute('data-name', ga.name);
            let htmlSwitch = Utils.searchTreeStartWith(ele, this.prefix);
            if (htmlSwitch) {
                const permission = checkPermission ? checkPermission(ga.property) : null;
                const factory = resolver.resolveComponentFactory(NgxSwitchComponent);
                const componentRef = viewContainerRef.createComponent(factory);
                htmlSwitch.innerHTML = '';

                componentRef.changeDetectorRef.detectChanges();
                const loaderComponentElement = componentRef.location.nativeElement;
                htmlSwitch.appendChild(loaderComponentElement);
                if (ga.property?.options) {
                    ga.property.options.height = htmlSwitch.clientHeight;
                    if (componentRef.instance.setOptions(ga.property.options)) {
                        if (ga.property.options.radius) {
                            htmlSwitch.style.borderRadius = ga.property.options.radius + 'px';
                        }
                    }
                }
                componentRef.instance.isReadonly = !!ga.property?.events?.length;
                componentRef.instance['name'] = ga.name;
                if (permission?.enabled === false) {
                    componentRef.instance.setDisabled(true);
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
        return HtmlSwitchComponent.initElement(ga, res, ref);
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
