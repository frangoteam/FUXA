import { Component } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component';
import { GaugeAction, GaugeSettings, GaugeStatus, Variable, GaugeActionsType, GaugePropertyColor, ButtonActionMode, ButtonActionProperty } from '../../../_models/hmi';
import { Utils } from '../../../_helpers/utils';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';

declare var SVG: any;

@Component({
    selector: 'html-button',
    templateUrl: './html-button.component.html',
    styleUrls: ['./html-button.component.css']
})
export class HtmlButtonComponent extends GaugeBaseComponent {


    static TypeTag = 'svg-ext-html_button';
    static LabelTag = 'HtmlButton';
    static prefixB = 'B-HXB_';
    static prefixRect = 'svg_';

    static actionsType = { hide: GaugeActionsType.hide, show: GaugeActionsType.show, blink: GaugeActionsType.blink };

    constructor() {
        super();
    }

    static getSignals(pro: any): string[] {
        let res: string[] = [];
        if (pro?.variableId) {
            res.push(pro.variableId);
        }
        if (pro?.actions && pro.actions.length) {
            pro.actions.forEach(act => {
                res.push(act.variableId);
            });
        }
        return res;
    }

    static PressedClass = 'md-btn-pressed';
    static MaxHoldTime = 3600;

    /**
     * true if the button has a valid toggle/press/set action configured on its tag
     */
    static hasButtonAction(ga: GaugeSettings): boolean {
        return !!ga?.type?.startsWith(this.TypeTag) && !!ga.property?.variableId && this.isButtonActionValid(ga.property.buttonAction);
    }

    /**
     * check that the values required by the action mode are defined
     */
    static isButtonActionValid(action: ButtonActionProperty): boolean {
        const isDefined = (value: string) => !Utils.isNullOrUndefined(value) && String(value).trim() !== '';
        switch (action?.mode) {
            case ButtonActionMode.toggle:
                return isDefined(action.offValue) && isDefined(action.onValue);
            case ButtonActionMode.press:
                return isDefined(action.pressValue) && isDefined(action.releaseValue) && this.isHoldTimeValid(action.minHoldTime);
            case ButtonActionMode.set:
                return isDefined(action.setValue);
            default:
                return false;
        }
    }

    /**
     * the press min. hold time has to be greater than 0 and not more than MaxHoldTime seconds
     */
    static isHoldTimeValid(holdTime: any): boolean {
        const value = Number(holdTime);
        return !Utils.isNullOrUndefined(holdTime) && String(holdTime).trim() !== '' && !Number.isNaN(value) && value > 0 && value <= this.MaxHoldTime;
    }

    /**
     * return the value that represents the active ('pressed') state of the button action
     */
    static getActiveValue(action: ButtonActionProperty): string {
        switch (action?.mode) {
            case ButtonActionMode.toggle:
                return action.onValue;
            case ButtonActionMode.press:
                return action.pressValue;
            case ButtonActionMode.set:
                return action.setValue;
            default:
                return null;
        }
    }

    /**
     * compare the tag value with the configured action value, considering the bitmask if defined
     */
    static isValueEqual(ga: GaugeSettings, value: any, target: string): boolean {
        if (Utils.isNullOrUndefined(value) || Utils.isNullOrUndefined(target)) {
            return false;
        }
        const bitmask = ga.property?.bitmask;
        if (bitmask) {
            return ((parseInt(value, 0) || 0) & bitmask) === ((parseInt(target, 0) || 0) & bitmask);
        }
        return String(value) === String(target);
    }

    /**
     * button state is active if the tag value matches the active value,
     * in press mode only while the press (and min. hold time) is in progress
     */
    static isActiveState(ga: GaugeSettings, button: HTMLElement, value: any): boolean {
        const action = ga.property?.buttonAction;
        let active = this.isButtonActionValid(action) && this.isValueEqual(ga, value, this.getActiveValue(action));
        if (active && action.mode === ButtonActionMode.press) {
            active = button.dataset.pressActive === 'true';
        }
        return active;
    }

    /**
     * track the tag value during a press: if the confirmed pressed value changes while the press
     * (or its min. hold time) is in progress, the press is interrupted and the released value is not written
     */
    static trackPressValue(ga: GaugeSettings, button: HTMLElement, value: any) {
        if (button.dataset.pressActive !== 'true') {
            return;
        }
        if (this.isValueEqual(ga, value, ga.property.buttonAction.pressValue)) {
            button.dataset.pressConfirmed = 'true';
        } else if (button.dataset.pressConfirmed === 'true') {
            button.dataset.pressInterrupted = 'true';
        }
    }

    /**
     * update the button by its state (active/inactive):
     * - render as pressed if enabled
     * - show the state label if defined, a missing label leaves the current one unchanged
     */
    static updateButtonState(ga: GaugeSettings, button: HTMLElement, value: any) {
        const action = ga.property?.buttonAction;
        if (!button || !action || action.mode === ButtonActionMode.none || Utils.isNullOrUndefined(action.mode)) {
            return;
        }
        const active = this.isActiveState(ga, button, value);
        button.classList.toggle(this.PressedClass, !!action.showPressed && active);
        const label = active ? action.activeLabel : action.inactiveLabel;
        if (!Utils.isNullOrUndefined(label) && String(label).trim() !== '' && button.dataset.stateLabel !== label) {
            button.dataset.stateLabel = label;
            this.setButtonContent(button, label, ga.property.icon, ga.property.image);
        }
    }

    static getDialogType(): GaugeDialogType {
        return GaugeDialogType.RangeAndText;
    }

    static getActions(type: string) {
        return this.actionsType;
    }

    static initElement(gab: GaugeSettings, textTranslation?: string): HTMLElement {
        let ele = document.getElementById(gab.id);
        if (ele && gab.property) {
            let htmlButton = Utils.searchTreeStartWith(ele, this.prefixB);
            if (htmlButton) {
                const icon = gab.property.icon;
                const image = gab.property.image;
                let text = textTranslation || gab.property.text;
                if (!icon && !image) {
                    text = text || gab.name;
                }
                this.setButtonContent(htmlButton, text, icon, image);
            }
        }
        return ele;
    }

    private static setButtonContent(htmlButton: HTMLElement, text: string, icon?: string, image?: string) {
        if (!icon && !image) {
            htmlButton.innerHTML = (text) ? text : '<span>&nbsp;</span>';
            return;
        }

        htmlButton.innerHTML = '';
        htmlButton.style.display = 'inline-flex';
        htmlButton.style.alignItems = 'center';
        htmlButton.style.justifyContent = 'center';
        htmlButton.style.gap = '8px';

        if (image) {
            const img = document.createElement('img');
            img.src = image;
            img.style.width = '1em';
            img.style.height = '1em';
            img.style.objectFit = 'contain';
            htmlButton.appendChild(img);
        } else if (icon) {
            const iconElement = document.createElement('span');
            iconElement.className = 'material-icons';
            iconElement.style.fontSize = '1em';
            iconElement.style.lineHeight = '1';
            iconElement.textContent = icon;
            htmlButton.appendChild(iconElement);
        }

        if (text) {
            const textElement = document.createElement('span');
            textElement.textContent = text;
            htmlButton.appendChild(textElement);
        }
    }

    static initElementColor(bkcolor, color, ele) {
        let htmlButton = Utils.searchTreeStartWith(ele, this.prefixB);
        if (htmlButton) {
            ele.setAttribute('fill', 'rgba(0, 0, 0, 0)');
            ele.setAttribute('stroke', 'rgba(0, 0, 0, 0)');
            for (let i = 0; i < ele.children.length; i++) {
                ele.children[i].removeAttribute('fill');
                ele.children[i].removeAttribute('stroke');
            }
            if (bkcolor) {
                htmlButton.style.backgroundColor = bkcolor;
            }
            if (color) {
                htmlButton.style.color = color;
            }
        }
    }

    static processValue(ga: GaugeSettings, element: HTMLElement | any, sig: Variable, gaugeStatus: GaugeStatus, isLabelType = false) {
        try {
            let button: HTMLElement = element instanceof HTMLElement ? element : null;
            if (button === null && element.node?.children && element.node.children.length >= 1) {
                button = Utils.searchTreeStartWith(element.node, this.prefixB);
            }
            if (button) {
                if (isLabelType) {
                    button.textContent = sig.value;
                    return;
                }
                let val = parseFloat(sig.value);
                if (Number.isNaN(val)) {
                    // maybe boolean
                    val = Number(sig.value);
                }
                if (ga.property) {
                    if (sig.id === ga.property.variableId && ga.property.buttonAction) {
                        if (ga.property.buttonAction.mode === ButtonActionMode.press) {
                            HtmlButtonComponent.trackPressValue(ga, button, sig.value);
                        }
                        HtmlButtonComponent.updateButtonState(ga, button, sig.value);
                    }
                    let propertyColor = new GaugePropertyColor();
                    if (ga.property.ranges) {
                        for (let idx = 0; idx < ga.property.ranges.length; idx++) {
                            if (ga.property.ranges[idx].min <= val && ga.property.ranges[idx].max >= val) {
                                propertyColor.fill = ga.property.ranges[idx].color;
                                propertyColor.stroke = ga.property.ranges[idx].stroke;
                            }
                        }
                        if (propertyColor.fill) {
                            button.style.backgroundColor = propertyColor.fill;
                        }
                        if (propertyColor.stroke) {
                            button.style.color = propertyColor.stroke;
                        }
                    }
                    // check actions
                    if (ga.property.actions) {
                        ga.property.actions.forEach(act => {
                            if (act.variableId === sig.id) {
                                HtmlButtonComponent.processAction(act, element, button, val, gaugeStatus, propertyColor);
                            }
                        });
                    }
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    static getFillColor(ele) {
        if (ele.children && ele.children[0]) {
            let htmlButton = Utils.searchTreeStartWith(ele, this.prefixB);
            if (htmlButton) {
                let result = htmlButton.style['background-color'];
                if (!result) {
                    result = htmlButton.getAttribute('fill');
                }
                if (result) {
                    return result;
                }
            }
        }
        return ele.getAttribute('fill');
    }

    static getStrokeColor(ele) {
        if (ele.children && ele.children[0]) {
            let htmlButton = Utils.searchTreeStartWith(ele, this.prefixB);
            if (htmlButton) {
                let result = htmlButton.style['color'];
                if (!result) {
                    result = htmlButton.getAttribute('stroke');
                }
                if (result) {
                    return result;
                }
            }
        }
        return ele.getAttribute('stroke');
    }

    static processAction(act: GaugeAction, svgele: any, button: HTMLElement | any, value: any, gaugeStatus: GaugeStatus, propertyColor?: GaugePropertyColor) {
        if (this.actionsType[act.type] === this.actionsType.hide) {
            if (act.range.min <= value && act.range.max >= value) {
                if (button === svgele) {
                    button.style.display = 'none';
                } else {
                    let element = SVG.adopt(svgele.node);
                    this.runActionHide(element, act.type, gaugeStatus);
                }
            }
        } else if (this.actionsType[act.type] === this.actionsType.show) {
            if (act.range.min <= value && act.range.max >= value) {
                if (button === svgele) {
                    button.style.display = 'unset';
                } else {
                    let element = SVG.adopt(svgele.node);
                    this.runActionShow(element, act.type, gaugeStatus);
                }
            }
        } else if (this.actionsType[act.type] === this.actionsType.blink) {
            let inRange = (act.range.min <= value && act.range.max >= value);
            this.checkActionBlink(button, act, gaugeStatus, inRange, true, propertyColor);
        }
    }
}
