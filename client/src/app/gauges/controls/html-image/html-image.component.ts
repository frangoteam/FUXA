import { Component } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component';
import { GaugeSettings } from '../../../_models/hmi';
import { Utils } from '../../../_helpers/utils';

@Component({
  selector: 'app-html-image',
  templateUrl: './html-image.component.html',
  styleUrls: ['./html-image.component.css']
})
export class HtmlImageComponent extends GaugeBaseComponent  {

  static TypeTag = 'svg-ext-own_ctrl-image';
  static LabelTag = 'HtmlImage';
  static prefixD = 'D-OXC_';

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
}
