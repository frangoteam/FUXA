import { Component } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component';
import { GaugeActionsType, GaugeProperty, GaugePropertyColor, GaugeSettings, GaugeStatus, Variable, WidgetProperty } from '../../../_models/hmi';
import { Utils } from '../../../_helpers/utils';
import { ShapesComponent } from '../../shapes/shapes.component';
import { EndPointApi } from '../../../_helpers/endpointapi';
import { SvgUtils } from '../../../_helpers/svg-utils';

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
                    if (isview) {
                        const scripts = svgImageContainer.querySelectorAll('script');
                        scripts.forEach(script => {
                            const newScript = document.createElement('script');
                            newScript.textContent = script.textContent;
                            document.body.appendChild(newScript);
                        });
                    } else {
                        svgImageContainer.innerHTML = '';
                        svgImageContainer.setAttribute('type', 'widget');
                        fetch(`${this.endPointConfig}${gaugeSettings.property.address}`)
                            .then(response => response.text())
                            .then(svgContent => {
                                const parser = new DOMParser();
                                const svgDocument = parser.parseFromString(svgContent, 'image/svg+xml');
                                const svgElement = svgDocument.querySelector('svg');
                                const boxSize = SvgUtils.getSvgSize(svgElement);
                                if (boxSize) {
                                    svgImageContainer.parentElement?.setAttribute('width', boxSize.width);
                                    svgImageContainer.parentElement?.setAttribute('height', boxSize.height);
                                }
                                const scripts = svgElement.querySelectorAll('script');
                                const svgGuid = Utils.getShortGUID('', '_');
                                const svgIdsMap = SvgUtils.renameIdsInSvg(svgElement, svgGuid);
                                let widgetResult;
                                scripts?.forEach(script => {
                                    // _pb_ for bool parameter and _pn_ for number parameter and _ps_ for string parameter.
                                    const newScript = document.createElement('script');
                                    widgetResult = SvgUtils.processWidget(script.textContent, svgGuid, svgIdsMap);
                                    newScript.textContent = widgetResult.content;
                                    document.body.appendChild(newScript);
                                    script.parentNode?.replaceChild(newScript, script);
                                });
                                svgImageContainer.appendChild(svgElement);
                                gaugeSettings.property = <WidgetProperty>{
                                    ...gaugeSettings.property,
                                    type: 'widget',
                                    varsToBind: widgetResult?.vars
                                };
                            });
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

    static getSignals(pro: any) {
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
                }
            }
        } catch (err) {
            console.error(err);
        }
    }
}
