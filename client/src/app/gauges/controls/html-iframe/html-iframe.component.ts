import { Component } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component';
import { GaugeSettings } from '../../../_models/hmi';
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

    static getDialogType(): GaugeDialogType {
        return GaugeDialogType.Iframe;
    }

    static initElement(gaugeSettings: GaugeSettings, isview: boolean) {
        let ele = document.getElementById(gaugeSettings.id);
        if (ele) {
            let svgIframeContainer = Utils.searchTreeStartWith(ele, this.prefixD);
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
                    iframe.setAttribute('src', gaugeSettings.property.address);
                }
                iframe.innerHTML = '&nbsp;';
                svgIframeContainer.appendChild(iframe);
            }
        }
    }

    static detectChange(gab: GaugeSettings): void {
        return HtmlIframeComponent.initElement(gab, false);
    }
}
