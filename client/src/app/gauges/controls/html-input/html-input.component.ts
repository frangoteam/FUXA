import { Component, Input } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component';
import { GaugeSettings, Variable, GaugeStatus, GaugeAction, Event, GaugeActionsType, InputOptionType, InputTimeFormatType, InputConvertionType } from '../../../_models/hmi';
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
    static InputDateTimeType = ['date','time', 'datetime'];

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
                    let val = parseFloat(sig.value);
                    let unit = null;
                    let digit = null;
                    let datetime = '';

                    if (ga.property.ranges) {
                        unit = GaugeBaseComponent.getUnit(ga.property, gaugeStatus);
                        digit = GaugeBaseComponent.getDigits(ga.property, gaugeStatus);
                    }

                    if (Number.isNaN(val)) {
                        // maybe boolean
                        val = Utils.toNumber(sig.value);
                    } else if (ga.property?.options?.type === InputOptionType.time) {
                        datetime = sig.value;
                        if (ga.property?.options?.convertion === InputConvertionType.milliseconds) {
                            datetime = Utils.millisecondsToTimeString(val,
                                ga.property?.options?.timeformat === InputTimeFormatType.milliseconds
                                    ? 1000
                                    : ga.property?.options?.timeformat === InputTimeFormatType.seconds
                                        ? 100
                                        : 0);
                        }
                    } else if (ga.property?.options?.type === InputOptionType.date || ga.property?.options?.type === InputOptionType.datetime) {
                        datetime = sig.value;
                        if (ga.property?.options?.convertion === InputConvertionType.milliseconds) {
                            if (ga.property?.options?.type === InputOptionType.date) {
                                datetime = Utils.millisecondsToDateString(val);
                            } else {
                                datetime = Utils.millisecondsToDateString(val,
                                    ga.property?.options?.timeformat === InputTimeFormatType.milliseconds
                                        ? 1000
                                        : ga.property?.options?.timeformat === InputTimeFormatType.seconds
                                            ? 100
                                            : ga.property?.options?.timeformat === InputTimeFormatType.normal
                                                ? 1
                                                : 0);
                            }
                        }
                    } else {
                        val = parseFloat(val.toFixed(digit || 5));
                    }

                    // Do not update value if input is in focus!
                    if (ga.property?.options?.updated && !(document.hasFocus && input.id == document.activeElement.id)) {
                        if (datetime) {
                            input.value = datetime;
                        } else {
                            if (ga.property?.options?.type === InputOptionType.text) {
                                input.value = sig.value;
                            } else {
                                input.value = val;
                            }
                            if (unit) {
                                input.value += ' ' + unit;
                            }
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

    static initElement(gab: GaugeSettings, isView: boolean): HtmlInputElement {
        let input: HTMLInputElement  = null;
        if (isView) {
            let ele = document.getElementById(gab.id);
            if (ele && gab.property) {
                ele?.setAttribute('data-name', gab.name);
                input = Utils.searchTreeStartWith(ele, this.prefix);
                if (input) {
                    input.value = '';
                    HtmlInputComponent.checkInputType(input, gab.property.options);
                    input.setAttribute('autocomplete', 'off');
                    if (gab.property.options) {
                        if (gab.property.options.numeric) {
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
                        // Check DateTime
                        if (HtmlInputComponent.InputDateTimeType.includes(gab.property.options?.type)) {
                            const setButton = document.createElement('button');
                            setButton.style.position = 'absolute';
                            setButton.style.left = '0';
                            setButton.style.height = '100%';
                            setButton.style.display = 'flex';
                            setButton.style.alignItems = 'center';
                            setButton.style.padding = '0 5px';
                            setButton.style.backgroundColor = 'unset';
                            setButton.style.border = 'none';
                            setButton.style.cursor = 'pointer';
                            const icon = document.createElement('i');
                            icon.className = 'material-icons';
                            icon.innerText = 'done';
                            icon.style.fontSize = window.getComputedStyle(input).getPropertyValue('font-size');
                            icon.style.fontWeight = 'bold';
                            setButton.appendChild(icon);
                            input.parentElement.insertBefore(setButton, input);

                            setButton.addEventListener('mousedown', startButtonPress);
                            setButton.addEventListener('touchstart', startButtonPress);
                            setButton.addEventListener('mouseup', resetButtonPress);
                            setButton.addEventListener('touchend', resetButtonPress);
                            function startButtonPress() {
                              setButton.style.backgroundColor = 'rgba(0,0,0,0.2)';
                            }
                            function resetButtonPress() {
                              setButton.style.backgroundColor = 'unset';
                            }

                            setButton.addEventListener('click', function() {
                              const enterKeyEvent = new KeyboardEvent('keydown', { key: 'Enter' });
                              input.dispatchEvent(enterKeyEvent);
                            });
                        }
                    }
                    // Adjust the width to better fit the surrounding svg rect
                    input.style.margin = '1px 1px';
                    input.style.display = 'flex';
                }
            }
            if (ele) {
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
        return new HtmlInputElement(input);
    }

    static checkInputType(input: HTMLElement, options?: any) {
        if (options?.type) {
            if (options.type === InputOptionType.datetime) {
                input.setAttribute('type', 'datetime-local');
            } else {
                input.setAttribute('type', options.type);
            }
            if (options.type === InputOptionType.time) {
                if (options.timeformat === InputTimeFormatType.seconds) {
                    input.setAttribute('step', '1');
                } else if (options.timeformat === InputTimeFormatType.milliseconds) {
                    input.setAttribute('step', '0.001');
                }
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

    static validateValue(value: any, ga: GaugeSettings): InputValueValidation {
        let result = <InputValueValidation> {
            valid: true,
            value: value,
            errorText: '',
            min: 0,
            max: 0
        };
        if (ga.property?.options?.numeric || ga.property?.options?.number === InputOptionType.number){
            if(!Utils.isNullOrUndefined(ga.property.options.min) && !Utils.isNullOrUndefined(ga.property.options.max)){
                if(Number.isNaN(value) || !(/^-?[\d.]+$/.test(value))){
                    return {
                        ...result,
                        valid: false,
                        errorText: 'html-input.not-a-number',
                    };
                }
                else {
                    let numVal = parseFloat(value);
                    if(numVal < ga.property.options.min || numVal > ga.property.options.max){
                        return {
                            ...result,
                            valid: false,
                            errorText: 'html-input.out-of-range',
                            min: ga.property.options.min,
                            max: ga.property.options.max
                        };
                    }
                }
            }
        } else if (ga.property?.options?.convertion === InputConvertionType.milliseconds && ga.property?.options?.type === InputOptionType.time) {
            const [hour, minute, seconds, milliseconds] = value.split(/:|\./);;
            result.value = ((hour ? parseInt(hour) * 3600 : 0)
                            + (minute ? parseInt(minute) * 60 : 0)
                            + (seconds ? parseInt(seconds) : 0)) * 1000
                            + (milliseconds ? parseInt(milliseconds) : 0);
        } else if (ga.property?.options?.convertion === InputConvertionType.milliseconds
            && (ga.property?.options?.type === InputOptionType.date || ga.property?.options?.type === InputOptionType.datetime)) {
            result.value = new Date(value).getTime();
        }
        return result;
    }
}

export interface InputValueValidation {
    valid: boolean;
    errorText: string;
    min: number;
    max: number;
    value: any;
}

export class HtmlInputElement {
    source: HTMLInputElement;

    constructor(input: HTMLInputElement) {
        this.source = input;
    }

    getValue(): string {
        return this.source.value;
    }
}
