import { Component, OnInit, Input } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component'
import { GaugeSettings, Variable, GaugeStatus, WindowLink, Event } from '../../../_models/hmi';
import { Utils } from '../../../_helpers/utils';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';

@Component({
    selector: 'html-select',
    templateUrl: './html-select.component.html',
    styleUrls: ['./html-select.component.css']
})
export class HtmlSelectComponent extends GaugeBaseComponent implements OnInit {

    @Input() data: any;

    static TypeTag = 'svg-ext-html_select';
    static LabelTag = 'HtmlSelect';
    static prefix = 'S-HXS_';

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
        return res;
    }

    static getDialogType(): GaugeDialogType {
        return GaugeDialogType.Step;
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
        }
    }

    static initElement(ga: GaugeSettings, isview: boolean = false) {
        let ele = document.getElementById(ga.id);
        if (ele) {
            let select = Utils.searchTreeStartWith(ele, this.prefix);            
            if (select) {
                if (ga.property) {
                    if (ga.property.readonly) {
                        select.disabled = true;
                        select.style['appearance'] = "none";
                        select.style['border-width'] = "0px";
                    } else {
                        select.style['appearance'] = "menulist";
                    }
                    let align = select.style['text-align'];
                    if (align) {
                        select.style['text-align-last'] = align;
                    }
                        
                }
                select.innerHTML = "";
                if (!isview) {
                    let option = document.createElement("option", );
                    option.disabled = true;
                    option.selected = true;//'<option value="" selected disabled hidden>Choose here</option>';
                    option.innerHTML = "Choose...";
                    select.appendChild(option);
                } else {
                    ga.property.ranges.forEach(element => {
                        let option = document.createElement("option");
                        option.value = element.min;
                        if (element.text) {
                            option.text = element.text;
                        }
                        select.appendChild(option);
                    });
                }
            }
        }
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
}
