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

        return String(Utils.normalizeTagValue(value)) === String(Utils.normalizeTagValue(target));
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

    /**
     * Bind events to the button element.
     */
    static bindAction(gab: GaugeSettings, element?: HTMLElement, callbacks?:  { read: () => any; write: (value: string) => void }): () => void {

        const { read: getValue, write: writeRaw } = callbacks || {};

        const writeValue = (value: string) => {
            if (gab.property.bitmask) {
                const current = parseInt(getValue?.(), 0) || 0;
                value = GaugeBaseComponent.valueBitmask(gab.property.bitmask, parseInt(value, 0) || 0, current).toString();
            }

            writeRaw?.(value);
        };

        const cleanups: Array<() => void> = [];

        const on = <K extends keyof HTMLElementEventMap>(
            target: HTMLElement,
            type: K,
            handler: (ev: HTMLElementEventMap[K]) => void
        ) => {
            target.addEventListener(type, handler);
            cleanups.push(() => target.removeEventListener(type, handler));
        };

        const action = gab.property.buttonAction;
        const button: HTMLElement = Utils.searchTreeStartWith(element, HtmlButtonComponent.prefixB);

        if (element && button) {
            element.style.touchAction = 'none';
            on(element, 'contextmenu', (ev) => ev.preventDefault());

            if (action.mode === ButtonActionMode.toggle || action.mode === ButtonActionMode.set) {
                let pressed: boolean | null = null;
                on(element, 'pointerdown', (ev: PointerEvent) => {pressed = ev.isPrimary;});
                on(element, 'pointerleave', () => { pressed = false; });
                on(element, 'pointerup', () => {
                    if (!pressed) {
                        return;
                    }
                    pressed = false;
                    if (action.mode === ButtonActionMode.set) {
                        writeValue(action.setValue);
                    } else {
                        const isOn = HtmlButtonComponent.isValueEqual(gab, getValue?.(), action.onValue);
                        writeValue(isOn ? action.offValue : action.onValue);
                    }
                });
            } else if (action.mode === ButtonActionMode.press) {
                let pressedAt: number | null = null;
                let releaseTimer: NodeJS.Timeout | null = null;

                const setPressActive = (active: boolean) => {
                    if (button) {
                        button.dataset.pressActive = String(active);
                        HtmlButtonComponent.updateButtonState(gab, button, getValue?.());
                    }
                };
                const release = () => {
                    // the tag changed during the press: don't revert it with the released value
                    if (button?.dataset.pressInterrupted !== 'true') {
                        writeValue(action.releaseValue);
                    }
                    setPressActive(false);
                };
                const onRelease = () => {
                    window.removeEventListener('pointerup', onRelease);
                    window.removeEventListener('pointercancel', onRelease);
                    window.removeEventListener('blur', onRelease);
                    if (pressedAt === null) {
                        return;
                    }
                    const remaining = Number(action.minHoldTime) * 1000 - (Date.now() - pressedAt);
                    pressedAt = null;
                    if (remaining > 0) {
                        releaseTimer = setTimeout(() => {
                            releaseTimer = null;
                            release();
                        }, remaining);
                    } else {
                        release();
                    }
                };

                on(element, 'pointerdown', (ev: PointerEvent) => {    
                    if (!ev.isPrimary || pressedAt !== null) {
                        return;
                    }
                    if (releaseTimer) {
                        clearTimeout(releaseTimer);
                    }

                    releaseTimer = null;
                    pressedAt = Date.now();
                    if (button) {
                        button.dataset.pressConfirmed = 'false';
                        button.dataset.pressInterrupted = 'false';
                    }
                    writeValue(action.pressValue);
                    setPressActive(true);
                    window.addEventListener('pointerup', onRelease);
                    window.addEventListener('pointercancel', onRelease);
                    window.addEventListener('blur', onRelease);
                });

            }
        }

        // Dispose removes only element-scoped listeners. In-flight presses complete
        // naturally via their window listeners and min-hold timer, so release value
        // is still written on physical pointerup even after view unload.
        return () => {
            cleanups.forEach(cleanup => cleanup());
            cleanups.length = 0; // prevent running cleanup again if the returned function is called multiple times
        };
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
