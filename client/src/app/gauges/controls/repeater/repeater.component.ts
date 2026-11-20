import { Component, ViewContainerRef, ComponentFactoryResolver } from '@angular/core';
import { GaugeBaseComponent } from '../../gauge-base/gauge-base.component';
import { Event, GaugeSettings, GaugeStatus, View, GaugeEventType, GaugeEventActionType, Variable } from '../../../_models/hmi';
import { Utils } from '../../../_helpers/utils';
import { GaugeDialogType } from '../../gauge-property/gauge-property.component';
import { HmiService } from '../../../_services/hmi.service';
import { EndPointApi } from '../../../_helpers/endpointapi';
import { RepeaterUtils } from '../../../_models/repeater';
import { GaugesManager } from '../../gauges.component';

declare var SVG: any;

/** a control of an item bound to tags of the item (e.g. a shape with tag @tags.Temperature), updated like in a view */
interface RepeaterGaugeBinding {
    /** id of the control in the item ('<template id>_<item key>') */
    id: string;
    /** settings of the template control with the '@' paths replaced by the tag ids */
    settings: GaugeSettings;
    status: GaugeStatus;
    tags: string[];
    /** element processed last time, a new one (content rebuilt) restarts the status (e.g. blink timer) */
    node?: Element;
}

@Component({
    selector: 'app-repeater',
    templateUrl: './repeater.component.html',
    styleUrls: ['./repeater.component.css']
})
export class RepeaterComponent extends GaugeBaseComponent {

    static scripts : any;
    static viewObjectsScripts : any;
    static endPointConfig: string = EndPointApi.getURL();
    static TypeTag = 'svg-ext-own_ctrl-repeat';
    static LabelTag = 'Repeater';
    static prefixD = 'D-OXC_';
    /** class of the search input in the Repeater toolbar */
    static searchClass = 'repeater-search';
    /** ids of the tags shown live by the items while rendering (e.g. @tags.Temperature with a tagList entry) */
    static renderLiveTags: Set<string> = null;
    static hmi: HmiService = null;

    constructor() {
        super();
    }

    static initElement(gaugeSettings: GaugeSettings, gaugeManager: GaugesManager, hmiService: HmiService, resolver: ComponentFactoryResolver, viewContainerRef: ViewContainerRef, isview: boolean, parent?: any): RepeaterComponent {
        let ele = document.getElementById(gaugeSettings.id);
        const createComponent = () => {
            let factory = resolver.resolveComponentFactory(RepeaterComponent);
            const componentRef = viewContainerRef.createComponent(factory);
            return componentRef.instance;
        };
        // A newly drawn Repeater has no settings yet: add it to the view and render
        // the data once a Repeater data source (with at least one line) is selected.
        let _repeater = gaugeSettings.property?.repeaterData ? hmiService.getRepeater(gaugeSettings.property.repeaterData) : null;
        const dataLine = _repeater?.lines?.[0];
        if (!dataLine) {
            return createComponent();
        }
        let dataJSONProperties = (dataLine.url_data_properties || '').split(",");
        let dataJSONPropertyToShow = gaugeSettings.property.repeaterDataPropertyToShow;
        this.hmi = hmiService;
        let view = gaugeSettings.property.view;
        var doc = new DOMParser();
        if (ele) {
            let svgDivContainer = Utils.searchTreeStartWith(ele, this.prefixD);
            while (svgDivContainer.firstChild) {
                svgDivContainer.removeChild(svgDivContainer.lastChild);
            }
            svgDivContainer.style['overflow'] = 'auto';
            // toolbar (search input) stays at the top, only the items scroll
            const toolbar = document.createElement('div');
            toolbar.className = 'repeater-toolbar';
            toolbar.style.position = 'sticky';
            toolbar.style.top = '0';
            toolbar.style.zIndex = '1';
            const containerBackground = getComputedStyle(svgDivContainer).backgroundColor;
            toolbar.style.backgroundColor = (!containerBackground || containerBackground === 'transparent' || containerBackground === 'rgba(0, 0, 0, 0)') ? '#ffffff' : containerBackground;
            if (isview) {
                // the control group has pointer-events:none (editor), the toolbar must be usable in the view
                toolbar.style.pointerEvents = 'auto';
            }
            const input = document.createElement('input');
            input.type = 'search';
            input.className = this.searchClass;
            input.placeholder = '\u{1F50D}';
            input.style.width = '100%';
            input.style.boxSizing = 'border-box';
            toolbar.appendChild(input);
            svgDivContainer.appendChild(toolbar);
            this.bindSearch(svgDivContainer);

            let v: View = this.getView(hmiService, view);
            if (!v) {
                return createComponent();
            }
            if (v.items?.[gaugeSettings.id]) {
                // the Repeater would copy the page it is placed in (including itself) for every item
                const message = document.createElement("div");
                message.style.padding = "5px";
                message.textContent = 'Repeater: select a different view, a Repeater cannot repeat the view it is placed in.';
                svgDivContainer.appendChild(message);
                return createComponent();
            }
            // in the view, clicks on the items run the events of the template controls through the hosting view
            svgDivContainer['repeaterContext'] = { view: v, parent, gaugeManager };
            if (isview && parent) {
                this.bindItemEvents(svgDivContainer);
            }
            this.viewObjectsScripts = {};
            Object.entries(v.items).forEach(entry => {
                try {
                    for(let e =0; e < entry[1]['property']['events'].length; e++) {
                        this.viewObjectsScripts[entry[1]['id'].toLowerCase()] = entry[1]['property']['events'][e]['actparam'];
                    }
                } catch (err) {}
            });
            this.scripts = hmiService.projectService.getScripts();
            // only the last load renders: a Repeater initialized again before the data arrived would add the items twice
            const loadId = (svgDivContainer['repeaterLoadId'] || 0) + 1;
            svgDivContainer['repeaterLoadId'] = loadId;
            RepeaterUtils.getItems(dataLine, _repeater.id).subscribe({ error: (err) => console.error(`Repeater: cannot load ${RepeaterUtils.isDb(dataLine) ? 'the DB data' : dataLine.url}`, err), next: result => {
                if (svgDivContainer['repeaterLoadId'] !== loadId) {
                    return;
                }
                // remove the items of a previous render (and stop their blink timers), the toolbar stays
                this.clearGaugeBindings(svgDivContainer);
                Array.from(svgDivContainer.children as HTMLCollectionOf<Element>).filter((child: Element) => child.nodeName.toLowerCase() === 'svg').forEach((child: Element) => child.remove());
                let jsonObj = result;
                if (svgDivContainer['repeaterContext']) {
                    svgDivContainer['repeaterContext'].items = jsonObj;
                }
                const fieldBindings = this.getFieldBindings(v);
                const gaugeBindings: RepeaterGaugeBinding[] = [];
                this.renderLiveTags = new Set<string>();
                Object.entries(jsonObj || {}).forEach(entry => {
                    if (svgDivContainer) {
                        try {
                            // without configured properties every field of the item is used (e.g. the columns of a DB row)
                            const itemProperties = dataJSONProperties.some(p => p) ? dataJSONProperties
                                : (entry[1] && typeof entry[1] === 'object' ? Object.keys(entry[1]) : []);
                            let prop = [entry, itemProperties];
                            var xml = doc.parseFromString(v.svgcontent, "image/svg+xml");
                            // a Repeater saved inside the repeated view (toolbar and rendered items) is not repeated
                            this.removeRepeaters(xml);
                            this.applyFieldBindings(xml, fieldBindings, entry[1]);
                            var svgNodes = xml.getElementsByTagName("svg");
                            this.modifyIdsOfElements(svgNodes, prop, dataJSONPropertyToShow);
                            this.applyViewStyle(svgNodes[0], v);
                            if (isview) {
                                (<SVGElement>svgNodes[0]).style.pointerEvents = 'auto';
                            }
                            svgNodes[0].setAttribute('data-repeater-item', entry[0]);
                            gaugeBindings.push(...this.getGaugeBindings(v, entry[0], entry[1]));
                            svgDivContainer.appendChild(svgNodes[0]);
                        } catch (err) {
                            console.error(`Repeater: cannot render item ${entry[0]}`, err);
                        }
                    }
                });
                // the items are parsed as XML: parse them again as HTML so that the HTML controls
                // in their foreignObject (input, button, ...) are rendered (events are delegated to the container).
                // Done before binding the controls, a later rebuild would leave them (e.g. a blink timer) on removed elements
                const search = (<HTMLInputElement>svgDivContainer.querySelector('.' + RepeaterComponent.searchClass))?.value;
                const focused = document.activeElement?.classList?.contains(RepeaterComponent.searchClass) && svgDivContainer.contains(document.activeElement);
                svgDivContainer.innerHTML = svgDivContainer.innerHTML;
                const searchInput = <HTMLInputElement>svgDivContainer.querySelector('.' + RepeaterComponent.searchClass);
                if (searchInput && search) {
                    searchInput.value = search;
                }
                if (searchInput && focused) {
                    searchInput.focus();
                }
                this.filterItems(svgDivContainer);
                gaugeBindings.forEach(binding => binding.tags.forEach(tagId => this.renderLiveTags.add(tagId)));
                svgDivContainer['repeaterGaugeBindings'] = gaugeBindings;
                const liveTags = Array.from(this.renderLiveTags);
                this.renderLiveTags = null;
                this.bindLiveTags(svgDivContainer, gaugeSettings.id, liveTags, hmiService);
                // current values (colors, ranges, actions) of the controls bound to tags
                this.updateGauges(svgDivContainer, liveTags.map(id => hmiService.variables[id]).filter(v => v && v.value !== undefined));
            } });
        }
        return createComponent();
    }

    static getScript = function (scriptsMap, _script) {
        return Object.entries(scriptsMap).find(s => s[1]['id'] === _script);
    }

    /** set the item data (field|value pairs, used by the search) and the '@field' texts on the item elements */
    static modifyIdsOfElements(node, properties, property) {
        const item = properties[0][1];
        const _data = properties[1].map(field => field + '|' + RepeaterComponent.fieldText(item?.[field])).join('&');
        const _id = properties[0][0];
        for (let i = 0; i < node.length; i++) {
            if (node[i].nodeType == 1) {
                const _text = item?.[property];
                node[i].setAttribute('data', _data);
                node[i].style.display = 'flex';
                this.recurseAndAdd(node[i], _data, _id, _text, item);
            }
        }
    }

    static recurseAndAdd(el, _data, _id, _text, item?: any) {
        const children = el.childNodes;
        for (let i = 0; i < children.length; i++) {
            if (children[i].nodeType !== 1) {
                continue;
            }
            if ('id' in children[i]) {
                const id = children[i].id;
                if (this.viewObjectsScripts.hasOwnProperty(id.toLowerCase())) {
                    // only events running a CLIENT script are wired, other events (e.g. open a view) are run by bindItemEvents
                    const scriptEntry = this.getScript(this.scripts || [], this.viewObjectsScripts[id.toLowerCase()]);
                    const script = scriptEntry?.[1];
                    if (script?.['mode'] === 'CLIENT') {
                        children[i].setAttribute('onclick', script['code']);
                    }
                }
                if (children[i].id !== '') {
                    children[i].id = children[i].id + '_' + _id;
                }
                children[i].setAttribute('data', _data);
                const nodeName = children[i].nodeName.toLowerCase();
                const content: string = children[i].innerHTML;
                if ((nodeName === 'text' || nodeName === 'input' || nodeName === 'button') && content?.startsWith('@')) {
                    // @field shows the value of that field of the item (fallback: the 'property to show')
                    const field = content.substring(1);
                    if (_data.indexOf(field + '|') >= 0 || RepeaterComponent.getItemField(item, field) !== undefined) {
                        const fieldValue = RepeaterComponent.resolveField(item, field, children[i]);
                        const value = (fieldValue !== undefined && fieldValue !== null) ? fieldValue : _text;
                        children[i].textContent = RepeaterComponent.fieldText(value);
                    }
                }
            }
            this.recurseAndAdd(children[i], _data, _id, _text, item);
        }
    }

    /** the item values are not bound to signals, live tags are subscribed while rendering (bindLiveTags) */
    static getSignals(pro: any): string[] {
        return [];
    }

    static getDialogType(): GaugeDialogType {
        return GaugeDialogType.Repeater;
    }

    static getHtmlEvents(ga: GaugeSettings): Event {
        return null;
    }

    static detectChange(gab: GaugeSettings, gaugeManager: GaugesManager, hmiService: HmiService, resolver: ComponentFactoryResolver, viewContainerRef: ViewContainerRef ): RepeaterComponent {
        return RepeaterComponent.initElement(gab, gaugeManager, hmiService, resolver, viewContainerRef, false);
    }

    /**
     * The item is placed inside the Repeater group, whose fill/stroke (white fill and black stroke by default)
     * would be inherited by the item elements without their own colors: reset them to the SVG defaults,
     * as in the standalone view, and use the view background color (not part of the view SVG content).
     */
    static applyViewStyle(itemSvg: Element, view: View) {
        const style = (<SVGElement>itemSvg).style;
        if (!style) {
            return;
        }
        style.setProperty('fill', '#000000');
        style.setProperty('stroke', 'none');
        style.setProperty('stroke-width', '1');
        if (view.profile?.bkcolor) {
            style.setProperty('background-color', view.profile.bkcolor);
        }
    }

    /**
     * Search in the toolbar: filter the items while typing or on Enter.
     * Listeners are delegated to the container because its content is rebuilt after rendering.
     */
    static bindSearch(container: HTMLElement) {
        if (container['repeaterSearchBound']) {
            return;
        }
        container['repeaterSearchBound'] = true;
        const isSearchInput = (target: EventTarget) => (<HTMLElement>target)?.classList?.contains(RepeaterComponent.searchClass);
        container.addEventListener('input', (event) => {
            if (isSearchInput(event.target)) {
                RepeaterComponent.filterItems(container);
            }
        });
        container.addEventListener('keydown', (event: KeyboardEvent) => {
            if (isSearchInput(event.target)) {
                event.stopPropagation();        // keep the keys away from the editor shortcuts
                if (event.key === 'Enter') {
                    event.preventDefault();
                    RepeaterComponent.filterItems(container);
                }
            }
        });
    }

    /**
     * Run the click events (open dialog, open view, set value, ...) of the template control under the click.
     * Item element ids are '<template id>_<item key>'. CLIENT scripts are left to the onclick attribute
     * set while rendering (it gets the item data as 'this'), to not run them twice.
     */
    static bindItemEvents(container: HTMLElement) {
        if (container['repeaterEventsBound']) {
            return;
        }
        container['repeaterEventsBound'] = true;
        const runScriptAction = Utils.getEnumKey(GaugeEventActionType, GaugeEventActionType.onRunScript);
        container.addEventListener('click', (event: MouseEvent) => {
            const context = container['repeaterContext'];
            const target = <Element>event.target;
            const itemRoot = target?.closest?.('[data-repeater-item]');
            if (!context?.parent || !itemRoot) {
                return;
            }
            const suffix = '_' + itemRoot.getAttribute('data-repeater-item');
            for (let node: Element = target; node && node !== itemRoot; node = node.parentElement) {
                if (!node.id) {
                    continue;
                }
                const templateId = node.id.endsWith(suffix) ? node.id.slice(0, -suffix.length) : node.id;
                const settings: GaugeSettings = context.view.items?.[templateId];
                if (!settings) {
                    continue;
                }
                const scripts = this.scripts || [];
                const events = (context.gaugeManager.getBindMouseEvent(settings, GaugeEventType.click) || []).filter(ev =>
                    !(ev.action === runScriptAction && scripts.find(s => s.id === ev.actparam)?.mode === 'CLIENT'));
                if (events.length) {
                    // pass the item fields to the opened view/dialog as placeholder values ('@country' -> item.country)
                    const placeholderValues = this.getPlaceholderValues(context.items?.[itemRoot.getAttribute('data-repeater-item')]);
                    const itemEvents = events.map(ev => ({ ...ev, actoptions: { ...ev.actoptions, placeholderValues } }));
                    const self = context.parent.parent || context.parent;
                    self.runEvents(self, settings, event, itemEvents);
                }
                return;
            }
        });
    }

    /** show only the items with a value containing the search text (case insensitive), all with empty search */
    static filterItems(container: HTMLElement) {
        const input = <HTMLInputElement>container.querySelector('.' + RepeaterComponent.searchClass);
        const search = (input?.value || '').trim().toLowerCase();
        Array.from(container.children).forEach((item: HTMLElement) => {
            if (item.nodeName.toLowerCase() !== 'svg') {
                return;
            }
            const values = (item.getAttribute('data') || '').split('&').map(pair => pair.substring(pair.indexOf('|') + 1));
            const text = (values.join(' ') + ' ' + (item.textContent || '')).toLowerCase();
            item.style.display = (!search || text.includes(search)) ? 'flex' : 'none';
        });
    }

    /** map the item fields to placeholders: { country: 'Italy' } -> { '@country': 'Italy' }, a plain value -> { '@value': value } */
    static getPlaceholderValues(item: any): { [placeholder: string]: any } {
        const values = {};
        if (item !== null && typeof item === 'object') {
            Object.entries(item).forEach(([key, value]) => {
                values['@' + key] = (value !== null && typeof value === 'object') ? JSON.stringify(value) : value;
            });
        } else if (item !== undefined) {
            values['@value'] = item;
        }
        return values;
    }

    /** controls of the repeated view bound to an item field: tag set to '@field' (e.g. an Output with tag @country) */
    static getFieldBindings(view: View): { id: string, field: string }[] {
        return Object.values(view.items || {})
            .filter(item => typeof item?.property?.variableId === 'string' && item.property.variableId.startsWith('@'))
            .map(item => ({ id: item.id, field: item.property.variableId.substring(1) }))
            .filter(binding => binding.field);
    }

    /** show the item field value in the text of the bound controls */
    static applyFieldBindings(xml: Document, bindings: { id: string, field: string }[], item: any) {
        bindings.forEach(binding => {
            const element = xml.querySelector(`[id="${binding.id}"]`);
            const text = element?.nodeName.toLowerCase() === 'text' ? element : element?.querySelector('text');
            if (text && item) {
                text.textContent = RepeaterComponent.fieldText(RepeaterComponent.resolveField(item, binding.field, text));
            }
        });
    }

    /**
     * value of an item field to show in an element. A field that is a tag entry (object with id and value,
     * e.g. @tags.Temperature with tags from devices.tagList) or its value (@tagList.Temperature.value)
     * is shown live: the element is marked with the tag id and updated on every value change
     */
    static resolveField(item: any, field: string, element: Element): any {
        let current = RepeaterUtils.decodeJson(RepeaterUtils.getField(item, field));
        const tagId = RepeaterUtils.getFieldTagId(item, field);
        if (tagId) {
            if (RepeaterUtils.isTagEntry(current)) {
                current = current.value;
            }
            element.setAttribute('data-repeater-tag', tagId);
            RepeaterComponent.renderLiveTags?.add(tagId);
            const variable = RepeaterComponent.hmi?.variables?.[tagId];
            if (variable && variable.value !== undefined && variable.value !== null) {
                current = variable.value;
            }
        }
        return current;
    }

    /** subscribe the tags shown live by the items and update their elements on value change */
    static bindLiveTags(container: HTMLElement, repeaterId: string, tagIds: string[], hmiService: HmiService) {
        container['repeaterLiveTags']?.unsubscribe();
        container['repeaterLiveTags'] = null;
        hmiService.setExtraTagsSubscription('repeater-' + repeaterId, tagIds);
        if (!tagIds.length) {
            return;
        }
        const ids = new Set(tagIds);
        const subscription = hmiService.onVariableChanged.subscribe(sig => {
            if (!container.isConnected) {
                // the view was closed
                RepeaterComponent.clearGaugeBindings(container);
                subscription.unsubscribe();
                hmiService.setExtraTagsSubscription('repeater-' + repeaterId, []);
                return;
            }
            if (!ids.has(sig?.id)) {
                return;
            }
            const text = RepeaterComponent.fieldText(sig.value);
            container.querySelectorAll(`[data-repeater-tag="${CSS.escape(sig.id)}"]`).forEach(element => {
                if (element.textContent !== text) {
                    element.textContent = text;
                }
            });
            // after the raw text: the controls show the value with their settings (format, colors, ranges, actions)
            RepeaterComponent.updateGauges(container, [sig]);
        });
        container['repeaterLiveTags'] = subscription;
    }

    /**
     * controls of the template view bound to tag entries of the item ('@tags.Temperature', also in the actions):
     * a copy of their settings with the tag ids, to update them like the controls of a view
     */
    static getGaugeBindings(view: View, itemKey: string, item: any): RepeaterGaugeBinding[] {
        const bindings: RepeaterGaugeBinding[] = [];
        Object.values(view.items || {}).forEach((settings: GaugeSettings) => {
            if (!settings?.property || settings.type?.startsWith(RepeaterComponent.TypeTag)) {
                return;
            }
            const tags: string[] = [];
            const toTag = (variableId: string): string => {
                if (typeof variableId !== 'string' || !variableId.startsWith('@')) {
                    return variableId;
                }
                const tagId = RepeaterUtils.getFieldTagId(item, variableId.substring(1));
                if (tagId) {
                    tags.push(tagId);
                }
                return tagId || variableId;
            };
            const property = JSON.parse(JSON.stringify(settings.property));
            property.variableId = toTag(property.variableId);
            (property.actions || []).forEach(action => action.variableId = toTag(action.variableId));
            if (tags.length) {
                const id = settings.id + '_' + itemKey;
                bindings.push({ id, settings: <GaugeSettings>{ ...settings, id, property }, status: new GaugeStatus(), tags });
            }
        });
        return bindings;
    }

    /** stop the actions (blink timers) of the controls of the rendered items */
    static clearGaugeBindings(container: HTMLElement) {
        (<RepeaterGaugeBinding[]>container['repeaterGaugeBindings'] || []).forEach(binding => RepeaterComponent.clearStatus(binding));
        container['repeaterGaugeBindings'] = [];
    }

    static clearStatus(binding: RepeaterGaugeBinding) {
        if (binding.status.actionRef?.timer) {
            clearInterval(binding.status.actionRef.timer);
            clearTimeout(binding.status.actionRef.timer);
        }
        binding.status = new GaugeStatus();
        binding.node = null;
    }

    /** process the values with the controls of the items bound to them */
    static updateGauges(container: HTMLElement, signals: Variable[]) {
        const bindings: RepeaterGaugeBinding[] = container['repeaterGaugeBindings'];
        const gaugeManager: GaugesManager = container['repeaterContext']?.gaugeManager;
        if (!bindings?.length || !gaugeManager || !signals.length) {
            return;
        }
        signals.forEach(sig => {
            bindings.filter(binding => binding.tags.includes(sig.id)).forEach(binding => {
                const element = container.querySelector(`[id="${CSS.escape(binding.id)}"]`);
                if (!element) {
                    return;
                }
                if (binding.node && binding.node !== element) {
                    // the content was rebuilt: restart the actions on the new element
                    RepeaterComponent.clearStatus(binding);
                }
                binding.node = element;
                try {
                    gaugeManager.processValue(binding.settings, SVG.adopt(element), sig, binding.status);
                } catch (err) {
                    console.error(`Repeater: cannot update ${binding.id}`, err);
                }
            });
        });
    }

    /** value of an item field, also nested with a dotted path: 'tagList.Temperature.value' (JSON text decoded) */
    static getItemField(item: any, field: string): any {
        return RepeaterUtils.getField(item, field);
    }

    /** text of a field value, objects as JSON */
    static fieldText(value: any): string {
        if (value === undefined || value === null) {
            return '';
        }
        return typeof value === 'object' ? JSON.stringify(value) : String(value);
    }

    /** remove the Repeater controls (with their toolbar and rendered items) from a parsed view */
    static removeRepeaters(xml: Document) {
        xml.querySelectorAll(`[type^="${RepeaterComponent.TypeTag}"], .repeater-toolbar`).forEach(element => element.remove());
    }

    /**
     * The editor saves the view SVG as shown, so a Repeater would be saved with its toolbar and all
     * rendered items: keep its container empty in the saved content (it is rendered again on load).
     */
    static stripRenderedContent(svgContent: string): string {
        if (!svgContent || svgContent.indexOf(RepeaterComponent.TypeTag) < 0) {
            return svgContent;
        }
        try {
            const xml = new DOMParser().parseFromString(svgContent, 'image/svg+xml');
            if (xml.getElementsByTagName('parsererror').length) {
                return svgContent;
            }
            xml.querySelectorAll(`[type^="${RepeaterComponent.TypeTag}"]`).forEach(repeater => {
                repeater.querySelectorAll(`[id^="${RepeaterComponent.prefixD}"]`).forEach(container => {
                    while (container.firstChild) {
                        container.removeChild(container.firstChild);
                    }
                });
            });
            // an emptied container would be written as '<DIV/>', the view (HTML parser) would not close it
            return Utils.fixSelfClosingHtml(new XMLSerializer().serializeToString(xml));
        } catch (err) {
            console.error('Repeater: cannot clean the view content', err);
            return svgContent;
        }
    }

    static getView(hmiService: HmiService, name: string) {
        for (var i = 0; i < hmiService.hmi.views.length; i++) {
            if (hmiService.hmi.views[i].id === name) {
                return hmiService.hmi.views[i];
            }
        }
        return null;
    }
}
