import { Component } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component';
import { GaugeSettings, Variable } from '../../../_models/hmi';
import { Utils } from '../../../_helpers/utils';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';

@Component({
    selector: 'app-html-textarea',
    templateUrl: './html-textarea.component.html',
    styleUrls: ['./html-textarea.component.css']
})
export class HtmlTextareaComponent extends GaugeBaseComponent {
    /**
     * Return the main HTML event for textarea (for compatibility with GaugesManager)
     * @param ga GaugeSettings
     */
    static getHtmlEvents(ga: GaugeSettings) {
        // getEvents returns GaugeEvent[], but GaugesManager expects a single Event
        const events = HtmlTextareaComponent.getEvents(ga.property, undefined);
        return Array.isArray(events) && events.length > 0 ? (events[0] as unknown as Event) : null;
    }

    static TypeTag = 'svg-ext-own_ctrl-textarea';
    static LabelTag = 'HtmlTextarea';
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
        return GaugeDialogType.Textarea;
    }

    static processValue(ga: GaugeSettings, svgele: any, sig: Variable) {
        try {
            if (svgele?.node?.children?.length >= 1) {
                const parentContainer = Utils.searchTreeStartWith(svgele.node, this.prefixD);
                const textarea = parentContainer?.querySelector('textarea');
                const options = ga.property?.options || {};
                if (textarea) {
                    // Always update rows/cols live
                    textarea.rows = options.rows || 7;
                    textarea.cols = options.cols || 24;
                    if (textarea.value !== sig.value) {
                        textarea.value = sig.value;
                        // Optionally trigger change event
                        const changeEvent = document.createEvent('Event');
                        changeEvent.initEvent('change', true, true);
                        textarea.dispatchEvent(changeEvent);
                    }
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    static initElement(gaugeSettings: GaugeSettings, isview: boolean): HTMLElement {
        let svgTextareaContainer = null;
        let ele = document.getElementById(gaugeSettings.id);
        if (ele) {
            ele?.setAttribute('data-name', gaugeSettings.name);
            svgTextareaContainer = Utils.searchTreeStartWith(ele, this.prefixD);
            if (svgTextareaContainer) {
                svgTextareaContainer.innerHTML = '';
                let textarea = document.createElement('textarea');
                textarea.setAttribute('name', gaugeSettings.name);
                textarea.placeholder = 'Enter your text...';
                // Use property.options for rows, cols, text, fontFamily, fontSize, textAlign
                const options = gaugeSettings.property?.options || {};
                textarea.rows = options.rows || 7;
                textarea.cols = options.cols || 24;
                textarea.value = options.text || '';
                // Calculate pixel size based on rows/cols
                // textarea.style['height'] = (textarea.rows * 20) + 'px';
                // textarea.style['width'] = (textarea.cols * 9) + 'px';
                textarea.style['height'] = 'inherit';
                textarea.style['width'] = 'inherit';
                // Font family, size, align from options (fallback to defaults)
                textarea.style['fontFamily'] = options.fontFamily || 'sans-serif';
                textarea.style['fontSize'] = (options.fontSize ? options.fontSize + 'px' : '14px');
                textarea.style['textAlign'] = options.textAlign || 'left';
                textarea.style['boxSizing'] = 'border-box';
                textarea.style['background'] = '#fff';
                textarea.style['color'] = '#000';
                textarea.style['resize'] = 'none'; // Prevent resizing
                textarea.style['overflow'] = 'hidden'; // Hide scrollbars
                // Set readonly and opacity for view mode
                if (isview && gaugeSettings.property?.readonly) {
                    textarea.readOnly = false;
                    textarea.style['opacity'] = '0.5';
                } else {
                    textarea.readOnly = true;
                    textarea.style['opacity'] = '1';
                }
                svgTextareaContainer.appendChild(textarea);
            }
        }
        return svgTextareaContainer;
    }

    static detectChange(gab: GaugeSettings): HTMLElement {
        return HtmlTextareaComponent.initElement(gab, false);
    }
}
