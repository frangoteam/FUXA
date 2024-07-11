import { Component } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component';
import { GaugeSettings, Variable, GaugeStatus, GaugeAction, Event, GaugeActionsType } from '../../../_models/hmi';
import { Utils } from '../../../_helpers/utils';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';

declare var SVG: any;

@Component({
    selector: 'html-select',
    templateUrl: './html-select.component.html',
    styleUrls: ['./html-select.component.css']
})
export class HtmlSelectComponent extends GaugeBaseComponent {


    static TypeTag = 'svg-ext-html_select';
    static LabelTag = 'HtmlSelect';
    static prefix = 'S-HXS_';

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
        return GaugeDialogType.Step;
    }

    static getActions(type: string) {
        return this.actionsType;
    }

    static getHtmlEvents(ga: GaugeSettings): Event {
        let ele = document.getElementById(ga.id);
        if (ele) {
            let select = Utils.searchTreeStartWith(ele, this.prefix);
            if (select) {
                let event = new Event();
                event.dom = select;
                event.type = 'change';
                event.ga = ga;
                return event;
            }
        }
        return null;
    }

    static processValue(ga: GaugeSettings, svgele: any, sig: Variable, gaugeStatus: GaugeStatus) {
        try {
            let select = Utils.searchTreeStartWith(svgele.node, this.prefix);
            if (select) {
                let val = parseFloat(sig.value);
                if (Number.isNaN(val)) {
                    // maybe boolean
                    val = Number(sig.value);
                } else {
                    val = parseFloat(val.toFixed(5));
                }
                select.value = val;

                // Set text and background color based on settings
                let range = ga.property.ranges.find(e => e.min == val);
                if (range){
                    select.style.background = range.color;
                    select.style.color = range.stroke;
                }

                // check actions
                if (ga.property.actions) {
                    ga.property.actions.forEach(act => {
                        if (act.variableId === sig.id) {
                            HtmlSelectComponent.processAction(act, svgele, select, val, gaugeStatus);
                        }
                    });
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    static initElement(ga: GaugeSettings, isview: boolean = false): HTMLElement {
        let select = null;
        let ele = document.getElementById(ga.id);
        if (ele) {
            ele?.setAttribute('data-name', ga.name);
            select = Utils.searchTreeStartWith(ele, this.prefix);
            if (select) {
                if (ga.property) {
                    if (ga.property.readonly) {
                        select.disabled = true;
                        select.style['appearance'] = 'none';
                        select.style['border-width'] = '0px';
                    } else {
                        select.style['appearance'] = 'menulist';
                    }
                    let align = select.style['text-align'];
                    if (align) {
                        select.style['text-align-last'] = align;
                    }

                }
                select.innerHTML = '';
                if (!isview) {
                    let option = document.createElement('option', );
                    option.disabled = true;
                    option.selected = true;//'<option value="" selected disabled hidden>Choose here</option>';
                    option.innerHTML = 'Choose...';
                    select.appendChild(option);
                } else {
                    ga.property?.ranges?.forEach(element => {
                        let option = document.createElement('option');
                        option.value = element.min;
                        if (element.text) {
                            option.text = element.text;
                        }
                        select.appendChild(option);
                    });
                }
            }
        }
        return select;
    }

    static initElementColor(bkcolor, color, ele) {
        let select = Utils.searchTreeStartWith(ele, this.prefix);
        if (select) {
            if (bkcolor) {
                select.style.backgroundColor = bkcolor;
            }
            if (color) {
                select.style.color = color;
            }
        }
    }

    static getFillColor(ele) {
        if (ele.children && ele.children[0]) {
            let select = Utils.searchTreeStartWith(ele, this.prefix);
            if (select) {
                return select.style.backgroundColor;
            }
        }
        return ele.getAttribute('fill');
    }

    static getStrokeColor(ele) {
        if (ele.children && ele.children[0]) {
            let select = Utils.searchTreeStartWith(ele, this.prefix);
            if (select) {
                return select.style.color;
            }
        }
        return ele.getAttribute('stroke');
    }

    static processAction(act: GaugeAction, svgele: any, select: any, value: any, gaugeStatus: GaugeStatus) {
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
}
