import { Injectable, ViewContainerRef, ComponentFactoryResolver } from '@angular/core';

import { GaugeSettings, Variable, GaugeStatus, WindowLink, Event } from '../../../_models/hmi';
import { Utils } from '../../../_helpers/utils';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';

import { NgxNouisliderComponent } from '../../../gui-helpers/ngx-nouislider/ngx-nouislider.component';

@Injectable()
export class SliderComponent {

    static TypeId = 'html_slider';
    static TypeTag = 'svg-ext-' + SliderComponent.TypeId;
    static LabelTag = 'HtmlSlider';
    static prefix = 'D-SLI_';

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
        return GaugeDialogType.Slider;
    }

    static bindEvents(ga: GaugeSettings, slider?: NgxNouisliderComponent, callback?:any): Event {
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

    static processValue(ga: GaugeSettings, svgele: any, sig: Variable, gaugeStatus: GaugeStatus, slider?: NgxNouisliderComponent) {
        if (slider) {
            let val = parseFloat(sig.value);
            if (Number.isNaN(val)) {
                // maybe boolean
                val = Number(sig.value);
            } else {
                val = parseFloat(val.toFixed(5));
            }
            slider.setValue(val);
        }
    }

    static initElement(gab: GaugeSettings, resolver: ComponentFactoryResolver, viewContainerRef: ViewContainerRef, options?: any) {
        let ele = document.getElementById(gab.id);
        if (ele) {
            let htmlSlider = Utils.searchTreeStartWith(ele, this.prefix);
            if (htmlSlider) {
                const factory = resolver.resolveComponentFactory(NgxNouisliderComponent);
                const componentRef = viewContainerRef.createComponent(factory);
                htmlSlider.innerHTML = '';

                componentRef.changeDetectorRef.detectChanges();
                const loaderComponentElement = componentRef.location.nativeElement;
                htmlSlider.appendChild(loaderComponentElement);
                componentRef.instance.resize(htmlSlider.clientHeight, htmlSlider.clientWidth);
                if (gab.property && gab.property.options) {
                    if (!componentRef.instance.setOptions(gab.property.options)) {
                        componentRef.instance.init();
                    }
                }
                return componentRef.instance;
            }
        }
    }

    static initElementColor(bkcolor, color, ele) {
        if (ele) {
            ele.setAttribute('fill', bkcolor);
        }
    }

    static resize(gab: GaugeSettings, resolver: ComponentFactoryResolver, viewContainerRef: ViewContainerRef, options?: any) {
        let ele = document.getElementById(gab.id);
        if (ele) {
            let htmlSlider = Utils.searchTreeStartWith(ele, this.prefix);
            if (htmlSlider) {        
                const factory = resolver.resolveComponentFactory(NgxNouisliderComponent);
                const componentRef = viewContainerRef.createComponent(factory);
                htmlSlider.innerHTML = '';

                componentRef.changeDetectorRef.detectChanges();
                const loaderComponentElement = componentRef.location.nativeElement;
                htmlSlider.appendChild(loaderComponentElement);
                componentRef.instance.resize(htmlSlider.clientHeight, htmlSlider.clientWidth);
                if (options) {
                    componentRef.instance.setOptions(options);
                }
                return componentRef.instance;
            }
        }
    }

    static getFillColor(ele) {
        if (ele) {
            return ele.getAttribute('fill');
        }
    }

    static detectChange(gab: GaugeSettings, res: any, ref: any) {
        let options;
        if (gab.property && gab.property.options) {
            options = gab.property.options;
        }
        return SliderComponent.initElement(gab, res, ref, options);
    }
}