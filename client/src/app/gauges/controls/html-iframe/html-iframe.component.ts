import { Component } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component';
import { GaugeSettings, Variable } from '../../../_models/hmi';
import { Utils } from '../../../_helpers/utils';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';

@Component({
    selector: 'app-html-iframe',
    templateUrl: './html-iframe.component.html',
    styleUrls: ['./html-iframe.component.css']
})
export class HtmlIframeComponent extends GaugeBaseComponent {
    static TypeTag = 'svg-ext-own_ctrl-iframe';
    static LabelTag = 'HtmlIframe';
    static prefixD = 'D-OXC_';

    constructor() {
        super();
    }

    static getSignals(pro: any) {
        let res: string[] = [];
        if (pro.variableId) {
            res.push(pro.variableId);
        }
        return res;
    }

    static getDialogType(): GaugeDialogType {
        return GaugeDialogType.Iframe;
    }

    static processValue(ga: GaugeSettings, svgele: any, sig: Variable) {
        try {
            if (sig.value && svgele?.node?.children?.length >= 1) {
                const parentIframe = Utils.searchTreeStartWith(svgele.node, this.prefixD);
                const iframe = parentIframe.querySelector('iframe');
                const src = iframe.getAttribute('src');
                if (src !== sig.value && Utils.isValidUrl(sig.value)) {
                    iframe.setAttribute('src', sig.value);
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    static initElement(gaugeSettings: GaugeSettings, isview: boolean): HTMLElement {
        let svgIframeContainer = null;
        let ele = document.getElementById(gaugeSettings.id);
        if (ele) {
            ele?.setAttribute('data-name', gaugeSettings.name);
            svgIframeContainer = Utils.searchTreeStartWith(ele, this.prefixD);
            if (svgIframeContainer) {
                svgIframeContainer.innerHTML = '';
                let iframe = document.createElement('iframe');
                iframe.setAttribute('name', gaugeSettings.name);
                iframe.style['width'] = '100%';
                iframe.style['height'] = '100%';
                iframe.style['border'] = 'none';
                iframe.style['background-color'] = '#F1F3F4';
                if (!isview) {
                    svgIframeContainer.innerHTML = 'iframe';
                    iframe.style['overflow'] = 'hidden';
                    iframe.style['pointer-events'] = 'none';
                }
                iframe.setAttribute('title', 'iframe');
                if (gaugeSettings.property && gaugeSettings.property.address && isview) {
                    if (Utils.isValidUrl(gaugeSettings.property.address)) {
                        iframe.setAttribute('src', gaugeSettings.property.address);
                    } else {
                        console.error('IFRAME URL not valid');
                    }
                }
                iframe.innerHTML = '&nbsp;';
                svgIframeContainer.appendChild(iframe);
            }
        }
        return svgIframeContainer;
    }

    static detectChange(gab: GaugeSettings): HTMLElement {
        return HtmlIframeComponent.initElement(gab, false);
    }
}
