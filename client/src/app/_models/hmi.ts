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
    showdev: boolean = true;
    zoom: ZoomModeType;
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
    permission: number;
}

export class HeaderSettings {
    title: string;
    alarms: NotificationModeType;
    infos: NotificationModeType;
    bkcolor: string;
    fgcolor: string;
}

export enum NotificationModeType {
    hide = 'item.notifymode-hide',
    fix = 'item.notifymode-fix',
    float = 'item.notifymode-float',
}

export enum ZoomModeType {
    disabled = 'item.zoommode-disabled',
    enabled = 'item.zoommode-enabled',
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
    permission: number;
    ranges: GaugeRangeProperty[];
    events: GaugeEvent[] = [];
    actions: GaugeAction[] = [];
    options: any;
    readonly: boolean;
}

export class GaugeEvent {
    type: string;
    action: string;
    actparam: string;
    actoptions = {};
}

export class GaugeAction {
    variableId: string;
    variableSrc: string;
    variable: string;    
    range: GaugeRangeProperty;
    type: any;
}

export class GaugeStatus {
    variablesValue = {};
    onlyChange = false;         // to process value only by change 
    takeValue = false;          // to process value by check change with gauge value
    actionRef: any;
}

export enum GaugeEventType {
    click = 'Click',
}

export enum GaugeEventActionType {
    onpage = 'Open Page',
    onwindow = 'Open Card',
    ondialog = 'Open Dialog',
    oniframe = 'Open iframe',
    oncard = 'Open Window',     // wrong name exchange with 'onwindow'
    onSetValue = 'Set Value',
    onSetInput = 'Set from Input',
    onclose = 'Close',
}

export class GaugeRangeProperty {
    min: number;
    max: number;
    text: string;
    color: string;
    type: any;
    style: any;
}

export class GaugeChartProperty {
    id: string;
    type: string;
    options: any;
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
