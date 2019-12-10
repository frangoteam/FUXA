import { Tag, Device } from './device';
import { extend } from 'webdriver-js-extender';

export class Hmi {
    layout: LayoutSettings = new LayoutSettings();
    views: View[] = [];
    // variables: Variable[] = [];
    // alarmes: Alarm[] = [];
    // devices = {};
}

export class View {
    id: string = '';
    name: string = '';
    profile: DocProfile = new DocProfile();
    items: DictionaryGaugeSettings = {};
    variables: DictionaryVariables = {};
    svgcontent: string = '';
}

export class LayoutSettings {
    start: string = '';
    navigation: NavigationSettings = new NavigationSettings();
    header: HeaderSettings = new HeaderSettings();
}

export class NavigationSettings {
    mode: NaviModeType;
    type: NaviItemType;
    bkcolor: string;
    fgcolor: string;
    items: NaviItem[];
    constructor() {
        this.mode = Object.keys(NaviModeType).find(key => NaviModeType[key] === NaviModeType.over) as NaviModeType;
        this.type = Object.keys(NaviItemType).find(key => NaviItemType[key] === NaviItemType.block) as NaviItemType;
    }
}

export enum NaviModeType {
    void = 'item.navsmode-none',
    push = 'item.navsmode-push',
    over = 'item.navsmode-over',
    fix = 'item.navsmode-fix',
}

export enum NaviItemType {
    icon = 'item.navtype-icons',
    text = 'item.navtype-text',
    block = 'item.navtype-icons-text-block',
    inline = 'item.navtype-icons-text-inline',
}

export class NaviItem {
    text: string;
    link: string;
    view: string;
    icon: string;
    level: number;
}

export class HeaderSettings {

}

export class DocProfile {
    width: number = 640;
    height: number = 480;
    bkcolor: string = '';
}

export class MyItem {

}

export class GaugeSettings {
    name: string = '';
    property: any = null;   // set to GaugeProperty after upgrate
    label: string = '';
    constructor(public id: string, public type: string) {
    }
}

export class GaugeProperty {
    variableId: string;
    variableSrc: string;
    variable: string;
    alarmId: string;
    alarmSrc: string;
    alarm: string;
    alarmColor: string;
    ranges: GaugeRangeProperty[];
    events: GaugeEvent[] = [];
}

export class GaugeEvent {
    type: string;
    action: string;
    actparam: string;
}

export enum GaugeEventType {
    click = 'Click',
}

export enum GaugeEventActionType {
    onpage = 'Open Page',
    onwindow = 'Open Window',
    ondialog = 'Open Dialog',
    onSetValue = 'Set Value',
}

export class GaugeRangeProperty {
    min: number;
    max: number;
    text: string;
    color: string;
    type: any;
    style: any;
}

export class Variable {
    id: string;
    name: string;
    source: string;
    value: string;
    constructor(id: string, source: string, name: string) {
        this.id = id; this.name = name; this.source = source;
    }
}

export class VariableRange {
    min: number;
    max: number;
}

export class Alarm extends Tag {
    id: string;
    group: string;
    device: string;
}

export class WindowLink {
    name: string = '';
    title: string = '';
    type: string;
}

export class SelElement {
    type: string = '';
    ele: any = null;
}

export class Event {
    id: string = '';
    dom: any;
    value: any = null;
    dbg: string = '';
    type: string;
    ga: GaugeSettings;
}

export class DaqQuery {
    gid: string;
    from: any;
    to: any;
    event: string;
    sids: string[];
}

export class DaqResult {
    gid: string;
    result: any;
}

export class HelpData {
    page: string;
    tag: string;
}

interface DictionaryGaugeSettings {
    [x: string]: GaugeSettings
}

interface DictionaryVariables {
    [id: string]: Variable
}
