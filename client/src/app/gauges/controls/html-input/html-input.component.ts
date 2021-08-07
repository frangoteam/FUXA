import { Component, OnInit, Input } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component'
import { GaugeSettings, Variable, GaugeStatus, GaugeAction, Event, GaugeActionsType } from '../../../_models/hmi';
import { Utils } from '../../../_helpers/utils';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';

declare var SVG: any;

@Component({
    selector: 'html-input',
    templateUrl: './html-input.component.html',
    styleUrls: ['./html-input.component.css']
})
export class HtmlInputComponent extends GaugeBaseComponent implements OnInit {

    @Input() data: any;

    static TypeTag = 'svg-ext-html_input';
    static LabelTag = 'HtmlInput';
    static prefix = 'I-HXI_';

    static actionsType = { hide: GaugeActionsType.hide, show: GaugeActionsType.show };

    constructor() {
        super();
    }

    ngOnInit() {
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
        return GaugeDialogType.OnlyValue;
    }

    static getActions() {
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
                    if (Number.isNaN(val)) {
                        // maybe boolean
                        val = Number(sig.value);
                    } else {
                        val = parseFloat(val.toFixed(5));
                    }
                    if (!input.value || input.value.length <= 0) {
                        input.value = val;
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
            console.log(err);
        }
    }

    static initElement(gab: GaugeSettings, isview: boolean) {
        if (isview) {
            let ele = document.getElementById(gab.id);        
            if (ele && gab.property) {
                let input = Utils.searchTreeStartWith(ele, this.prefix);
                if (input) {
                    input.value = '';
                    input.setAttribute('autocomplete', 'off');
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
}
