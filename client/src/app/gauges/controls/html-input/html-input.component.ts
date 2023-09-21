import { Component, Input } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component';
import { GaugeSettings, Variable, GaugeStatus, GaugeAction, Event, GaugeActionsType } from '../../../_models/hmi';
import { Utils } from '../../../_helpers/utils';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';

declare var SVG: any;

@Component({
    selector: 'html-input',
    templateUrl: './html-input.component.html',
    styleUrls: ['./html-input.component.css']
})
export class HtmlInputComponent extends GaugeBaseComponent {

    @Input() data: any;

    static TypeTag = 'svg-ext-html_input';
    static LabelTag = 'HtmlInput';
    static prefix = 'I-HXI_';

    static actionsType = { hide: GaugeActionsType.hide, show: GaugeActionsType.show };

    constructor() {
        super();
    }

    static getSignals(pro: any) {
        let res: string[] = [];
        if (pro.variableId) {
            res.push(pro.variableId);
        }
        if (pro.actions && pro.actions.length) {
            pro.actions.forEach(act => {
                res.push(act.variableId);
            });
        }
        return res;
    }

    static getDialogType(): GaugeDialogType {
        return GaugeDialogType.Input;
    }

    static getActions(type: string) {
        return this.actionsType;
    }

    static getHtmlEvents(ga: GaugeSettings): Event {
        let ele = document.getElementById(ga.id);
        if (ele) {
            let input = Utils.searchTreeStartWith(ele, this.prefix);
            if (input) {
                let event = new Event();
                event.dom = input;
                event.type = 'key-enter';
                event.ga = ga;
                return event;
            }
        }
        return null;
    }

    static processValue(ga: GaugeSettings, svgele: any, sig: Variable, gaugeStatus: GaugeStatus) {
        try {
            if (svgele.node && svgele.node.children && svgele.node.children.length >= 1) {
                let input = Utils.searchTreeStartWith(svgele.node, this.prefix);
                if (input) {
                    let val: any = parseFloat(sig.value);
                    let unit;
                    let digit;

                    if (ga.property.ranges) {
                        unit = GaugeBaseComponent.getUnit(ga.property, gaugeStatus);
                        digit = GaugeBaseComponent.getDigits(ga.property, gaugeStatus);
                    }

                    if (Number.isNaN(val)) {
                        // maybe boolean
                        val = Utils.toNumber(sig.value);
                    } else {
                        val = parseFloat(val.toFixed(digit || 5));
                    }

                    // Do not update value if input is in focus!
                    if(ga.property.options && ga.property.options.updated && !(document.hasFocus && input.id == document.activeElement.id)){
                        input.value = val;
                        if(unit){
                            input.value += ' ' + unit;
                        }
                    }
                    // check actions
                    if (ga.property.actions) {
                        ga.property.actions.forEach(act => {
                            if (act.variableId === sig.id) {
                                HtmlInputComponent.processAction(act, svgele, input, val, gaugeStatus);
                            }
                        });
                    }
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    static initElement(gab: GaugeSettings, isView: boolean) {
        if (isView) {
            let ele = document.getElementById(gab.id);
            if (ele && gab.property) {
                let input = Utils.searchTreeStartWith(ele, this.prefix);
                if (input) {
                    input.value = '';
                    input.setAttribute('autocomplete', 'off');
                    if (gab.property.options && gab.property.options.numeric) {
                        const min = parseFloat(gab.property.options.min);
                        const max = parseFloat(gab.property.options.max);
                        input.addEventListener('keydown', (event: KeyboardEvent) => {
                            try {
                                if (event.code === 'Enter' && !event.view) {
                                    const value = parseFloat(input.value);
                                    let warningMessage = '';
                                    if (min > value) {
                                        warningMessage += `Min=${min} `;
                                    }
                                    if (max < value) {
                                        warningMessage += `Max=${max} `;
                                    }
                                    if (warningMessage) {
                                        let inputPosition = input.getBoundingClientRect();
                                        const tooltip = document.createElement('div');
                                        tooltip.innerText = warningMessage;
                                        tooltip.style.position = 'absolute';
                                        tooltip.style.top = `${inputPosition.top + input.offsetHeight + 3}px`;
                                        tooltip.style.left = `${inputPosition.left}px`;
                                        tooltip.style.zIndex = '99999';
                                        tooltip.style.padding = '3px 5px';
                                        tooltip.style.border = '1px solid black';
                                        tooltip.style.backgroundColor = 'white';
                                        document.body.appendChild(tooltip);
                                        setTimeout(() => {
                                            document.body.removeChild(tooltip);
                                        }, 2000);
                                    }
                                }
                            } catch (err) {
                                console.error(err);
                            }
                        });
                    }

                    // Adjust the width to better fit the surrounding svg rect
                    input.style.width = 'calc(100% - 5px)';
                }
            }

            // Input element is npt precisely aligned to the center of the surrounding rectangle. Compensate it with the padding.
        let fobj = ele.getElementsByTagName('foreignObject');
            if(fobj){
                fobj[0].style.paddingLeft = '1px';
            }

            // Set the border on the surrounding svg rect
        let rects = ele.getElementsByTagName('rect');
            if(rects){
                rects[0].setAttribute('stroke-width','0.5');
            }
        }
    }

    static initElementColor(bkcolor, color, ele) {
        let htmlInput = Utils.searchTreeStartWith(ele, this.prefix);
        if (htmlInput) {
            if (bkcolor) {
                htmlInput.style.backgroundColor = bkcolor;
            }
            if (color) {
                htmlInput.style.color = color;
            }
        }
    }

    static getFillColor(ele) {
        if (ele.children && ele.children[0]) {
            let htmlInput = Utils.searchTreeStartWith(ele, this.prefix);
            if (htmlInput) {
                return htmlInput.style.backgroundColor;
            }
        }
        return ele.getAttribute('fill');
    }

    static getStrokeColor(ele) {
        if (ele.children && ele.children[0]) {
            let htmlInput = Utils.searchTreeStartWith(ele, this.prefix);
            if (htmlInput) {
                return htmlInput.style.color;
            }
        }
        return ele.getAttribute('stroke');
    }

    static processAction(act: GaugeAction, svgele: any, input: any, value: any, gaugeStatus: GaugeStatus) {
        if (this.actionsType[act.type] === this.actionsType.hide) {
            if (act.range.min <= value && act.range.max >= value) {
                let element = SVG.adopt(svgele.node);
                this.runActionHide(element, act.type, gaugeStatus);
            }
        } else if (this.actionsType[act.type] === this.actionsType.show) {
            if (act.range.min <= value && act.range.max >= value) {
                let element = SVG.adopt(svgele.node);
                this.runActionShow(element, act.type, gaugeStatus);
            }
        }
    }

    static validateValue(value: any, ga: GaugeSettings): {valid: boolean; errorText: string; min: number; max: number} {
        if(ga.property?.options && ga.property.options?.numeric){
            if(!Utils.isNullOrUndefined(ga.property.options.min) && !Utils.isNullOrUndefined(ga.property.options.max)){
                if(Number.isNaN(value) || !(/^-?[\d.]+$/.test(value))){
                    return {valid: false, errorText: 'html-input.not-a-number', min: 0, max: 0};
                }
                else {
                    let numVal = parseFloat(value);
                    if(numVal < ga.property.options.min || numVal > ga.property.options.max){
                        return { valid: false, errorText: 'html-input.out-of-range',
                                min: ga.property.options.min, max: ga.property.options.max };
                    }
                }
            }
        }

        return { valid: true, errorText: '', min: 0, max: 0 };
    }
}
