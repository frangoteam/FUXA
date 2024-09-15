import { Component } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component';
import { GaugeActionsType, GaugeProperty, GaugePropertyColor, GaugeSettings, GaugeStatus, Variable, WidgetProperty, Event } from '../../../_models/hmi';
import { Utils } from '../../../_helpers/utils';
import { ShapesComponent } from '../../shapes/shapes.component';
import { EndPointApi } from '../../../_helpers/endpointapi';
import { SvgUtils, WidgetPropertyVariable } from '../../../_helpers/svg-utils';

@Component({
    selector: 'app-html-image',
    templateUrl: './html-image.component.html',
    styleUrls: ['./html-image.component.css']
})
export class HtmlImageComponent extends GaugeBaseComponent {

    static TypeTag = 'svg-ext-own_ctrl-image';
    static LabelTag = 'HtmlImage';
    static prefixD = 'D-OXC_';
    static endPointConfig: string = EndPointApi.getURL();
    static propertyWidgetType = 'widget';

    static actionsType = {
        hide: GaugeActionsType.hide, show: GaugeActionsType.show, blink: GaugeActionsType.blink, stop: GaugeActionsType.stop,
        clockwise: GaugeActionsType.clockwise, anticlockwise: GaugeActionsType.anticlockwise, rotate: GaugeActionsType.rotate,
        move: GaugeActionsType.move
    };
    constructor() {
        super();
    }

    static initElement(gaugeSettings: GaugeSettings, isview: boolean): HTMLElement {
        let svgImageContainer = null;
        let ele = document.getElementById(gaugeSettings.id);
        if (ele) {
            ele?.setAttribute('data-name', gaugeSettings.name);
            svgImageContainer = Utils.searchTreeStartWith(ele, this.prefixD);
            if (svgImageContainer) {
                if (SvgUtils.isSVG(gaugeSettings.property.address)) {
                    svgImageContainer.innerHTML = '';
                    svgImageContainer.setAttribute('type', 'widget');
                    let svgContent = gaugeSettings.property.svgContent ?? localStorage.getItem(gaugeSettings.property.address);
                    const parser = new DOMParser();
                    const svgDocument = parser.parseFromString(svgContent, 'image/svg+xml');
                    const svgElement = svgDocument.querySelector('svg');
                    const boxSize = SvgUtils.getSvgSize(svgElement);
                    if (boxSize) {
                        svgImageContainer.parentElement?.setAttribute('width', boxSize.width);
                        svgImageContainer.parentElement?.setAttribute('height', boxSize.height);
                    }

                    if (isview) {
                        svgImageContainer.appendChild(svgElement);
                        if (gaugeSettings.property.scriptContent) {
                            const newScript = document.createElement('script');
                            newScript.textContent = SvgUtils.initWidget(gaugeSettings.property.scriptContent.content, gaugeSettings.property.varsToBind);
                            document.body.appendChild(newScript);
                        }
                    } else if (!gaugeSettings.property.svgContent) {
                        const scripts = svgElement.querySelectorAll('script');
                        const svgGuid = Utils.getShortGUID('', '_');
                        const svgIdsMap = SvgUtils.renameIdsInSvg(svgElement, svgGuid);
                        const moduleId = `wModule_${svgGuid}`;
                        let widgetResult;
                        scripts?.forEach(script => {
                            widgetResult = SvgUtils.processWidget(script.textContent, moduleId, svgIdsMap, gaugeSettings.property?.varsToBind);
                            script.parentNode.removeChild(script);
                        });
                        svgImageContainer.appendChild(svgElement);
                        gaugeSettings.property = <WidgetProperty>{
                            ...gaugeSettings.property,
                            type: HtmlImageComponent.propertyWidgetType,
                            svgContent: svgImageContainer.innerHTML,
                            scriptContent: { moduleId: moduleId, content: widgetResult?.content },
                            varsToBind: Utils.mergeArray([widgetResult?.vars, gaugeSettings.property.varsToBind], 'originalName')
                        };
                    } else {
                        svgImageContainer.appendChild(svgElement);
                    }
                } else {
                    svgImageContainer.innerHTML = '';
                    let image = document.createElement('img');
                    image.style['width'] = '100%';
                    image.style['height'] = '100%';
                    image.style['border'] = 'none';
                    if (gaugeSettings.property && gaugeSettings.property.address) {
                        image.setAttribute('src', gaugeSettings.property.address);
                    }
                    svgImageContainer.appendChild(image);
                }
            }
        }
        return svgImageContainer;
    }

    static getSignals(pro: any | WidgetProperty) {
        let res: string[] = [];
        if (pro.variableId) {
            res.push(pro.variableId);
        }
        if (pro.alarmId) {
            res.push(pro.alarmId);
        }
        if (pro.actions && pro.actions.length) {
            pro.actions.forEach(act => {
                res.push(act.variableId);
            });
        }
        pro.varsToBind?.forEach((varToBind: WidgetPropertyVariable) => {
            if (varToBind.variableId) {
                res.push(varToBind.variableId);
            }
        });
        return res;
    }

    static getActions(type: string) {
        return this.actionsType;
    }

    static isBitmaskSupported(): boolean {
        return true;
    }

    static processValue(ga: GaugeSettings, svgele: any, sig: Variable, gaugeStatus: GaugeStatus) {
        try {
            if (svgele.node) {
                let value = parseFloat(sig.value);
                if (Number.isNaN(value)) {
                    // maybe boolean
                    value = Number(sig.value);
                } else {
                    value = parseFloat(value.toFixed(5));
                }
                if (ga.property) {
                    let propValue = GaugeBaseComponent.checkBitmask((<GaugeProperty>ga.property).bitmask, value);
                    let propertyColor = new GaugePropertyColor();
                    if (ga.property.variableId === sig.id && ga.property.ranges) {
                        for (let idx = 0; idx < ga.property.ranges.length; idx++) {
                            if (ga.property.ranges[idx].min <= propValue && ga.property.ranges[idx].max >= propValue) {
                                propertyColor.fill = ga.property.ranges[idx].color;
                                propertyColor.stroke = ga.property.ranges[idx].stroke;
                            }
                        }
                        // check if general shape (line/path/fpath/text) to set the stroke
                        if (propertyColor.fill) {
                            svgele.node.setAttribute('fill', propertyColor.fill);
                        }
                        if (propertyColor.stroke) {
                            svgele.node.setAttribute('stroke', propertyColor.stroke);
                        }

                    }
                    // check actions
                    if (ga.property.actions) {
                        ga.property.actions.forEach(act => {
                            if (act.variableId === sig.id) {
                                ShapesComponent.processAction(act, svgele, value, gaugeStatus, propertyColor);
                            }
                        });
                    }
                    // check widget
                    if (ga.property.type === HtmlImageComponent.propertyWidgetType && ga.property.scriptContent && ga.property.varsToBind?.length) {
                        const scriptContent = ga.property.scriptContent;
                        if (window[scriptContent.moduleId]['putValue']) {
                            const widgetVar = <WidgetPropertyVariable> ga.property.varsToBind?.find((varToBind: WidgetPropertyVariable) => varToBind.variableId === sig.id);
                            if (widgetVar) {
                                window[scriptContent.moduleId]['putValue'](widgetVar.name, sig.value);
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    static bindEvents(ga: GaugeSettings, callback?: any): Event {
        if (ga.property.type === HtmlImageComponent.propertyWidgetType && ga.property.scriptContent && ga.property.varsToBind?.length) {
            const scriptContent = ga.property.scriptContent;
            if (window[scriptContent.moduleId]['postValue']) {
                window[scriptContent.moduleId]['postValue'] = (varName, value) => {
                    const widgetVar = <WidgetPropertyVariable> ga.property.varsToBind?.find((varToBind: WidgetPropertyVariable) => varToBind.name === varName);
                    if (widgetVar) {
                        let event = new Event();
                        event.type = HtmlImageComponent.propertyWidgetType;
                        event.ga = ga;
                        event.value = value;
                        event.variableId = widgetVar.variableId;
                        callback(event);
                    } else {
                        console.error(`Variable name (${varName}) not found!`);
                    }
                };
            } else {
                console.error(`Module (${scriptContent.moduleId}) or postValue function not found!`);
            }
        }
        return null;
    }
}
