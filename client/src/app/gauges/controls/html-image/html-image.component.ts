import { Component } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component';
import { GaugeActionsType, GaugeProperty, GaugePropertyColor, GaugeSettings, GaugeStatus, Variable } from '../../../_models/hmi';
import { Utils } from '../../../_helpers/utils';
import { ShapesComponent } from '../../shapes/shapes.component';

@Component({
    selector: 'app-html-image',
    templateUrl: './html-image.component.html',
    styleUrls: ['./html-image.component.css']
})
export class HtmlImageComponent extends GaugeBaseComponent {

    static TypeTag = 'svg-ext-own_ctrl-image';
    static LabelTag = 'HtmlImage';
    static prefixD = 'D-OXC_';

    static actionsType = { hide: GaugeActionsType.hide, show: GaugeActionsType.show, blink: GaugeActionsType.blink, stop: GaugeActionsType.stop,
                        clockwise: GaugeActionsType.clockwise, anticlockwise: GaugeActionsType.anticlockwise, rotate : GaugeActionsType.rotate,
                        move: GaugeActionsType.move };
    constructor() {
        super();
    }

    static initElement(gaugeSettings: GaugeSettings, isview: boolean) {
        let ele = document.getElementById(gaugeSettings.id);
        if (ele) {
            let svgImageContainer = Utils.searchTreeStartWith(ele, this.prefixD);
            if (svgImageContainer) {
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
