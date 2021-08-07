import { Tag, Device } from './device';
import { extend } from 'webdriver-js-extender';

export class Hmi {
    /** Layout for navigation menu, header bar, ...  */
    layout: LayoutSettings = new LayoutSettings();
    /** Views list of hmi project */
    views: View[] = [];
}

export class View {
    /** View id, random number */
    id: string = '';
    /** View name used as reference in configuration */
    name: string = '';
    /** View profile size, background color */
    profile: DocProfile = new DocProfile();
    /** Gauges settings list used in the view  */
    items: DictionaryGaugeSettings = {};
    /** Variables (Tags) list used in the view */
    variables: DictionaryVariables = {};
    /** Svg code content of the view  */
    svgcontent: string = '';
    /** Type of view SVG/CARDS */
    type: ViewType;
}

export enum ViewType {
    svg = 'SVG',
    cards ='CARDS'
} 

export class LayoutSettings {
    /** Start view (home) */
    start: string = '';
    /** Left side navigation menu settings */
    navigation: NavigationSettings = new NavigationSettings();
    /** On top header settings */
    header: HeaderSettings = new HeaderSettings();
    /** Show development blue button (Home, Lab, Editor) */
    showdev: boolean = true;
    /** Enable zoom in view */
    zoom: ZoomModeType;
    /** Show input dialog for input field */
    inputdialog: string = 'false';
}

export class NavigationSettings {
    /** Side menu mode (over, push, fix) */
    mode: NaviModeType;
    /** Menu item show type (text, icon) */
    type: NaviItemType;
    /** Menu background color */
    bkcolor: string;
    /** Menu item text and icon color */
    fgcolor: string;
    /** Menu items */
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

export enum InputModeType {
    false = 'item.inputmode-disabled',
    true = 'item.inputmode-enabled',
}

export class DocProfile {
    width: number = 640;
    height: number = 480;
    bkcolor: string = '';
    margin: number = 10;
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
    variableValue: string;
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

export enum GaugeActionsType {
    hide = 'shapes.action-hide',
    show = 'shapes.action-show',
    blink = 'shapes.action-blink',
    stop = 'shapes.action-stop',
    clockwise = 'shapes.action-clockwise',
    anticlockwise = 'shapes.action-anticlockwise',
    downup = 'shapes.action-downup'
}

export class GaugeAction {
    variableId: string;
    range: GaugeRangeProperty;
    type: any;
    options: any = {};
}

export class GaugeActionBlink {
    strokeA: string = null;
    strokeB: string = null;
    fillA: string = null;
    fillB: string = null;
    interval: number = 1000;
}

export class GaugeStatus {
    variablesValue = {};
    onlyChange = false;         // to process value only by change
    takeValue = false;          // to process value by check change with gauge value
    actionRef: GaugeActionStatus;
}

export class GaugeActionStatus {
    type: string;
    timer: any = null;
    animr: any = null;
    spool: any;
    constructor(type: string) {
        this.type = type;
    }
}

export enum GaugeEventType {
    click = 'shapes.event-click',
}

export enum GaugeEventActionType {
    onpage = 'shapes.event-onpage',
    onwindow = 'shapes.event-onwindow',
    ondialog = 'shapes.event-ondialog',
    oniframe = 'shapes.event-oniframe',
    oncard = 'shapes.event-oncard',     // wrong name exchange with 'onwindow'
    onSetValue = 'shapes.event-onsetvalue',
    onToggleValue = 'shapes.event-ontogglevalue',
    onSetInput = 'shapes.event-onsetinput',
    onclose = 'shapes.event-onclose',
}

export class GaugeRangeProperty {
    min: number;
    max: number;
    text: string;
    textId: string;
    color: string;
    type: any;
    style: any;
    stroke: string;
}

export interface GaugeChartProperty {
    id: string;
    type: string;
    options: any;
}

export class Variable {
    id: string;
    name: string;
    source: string;
    value: string;
    error: number;
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

export enum DateFormatType {
    YYYY_MM_DD = '1998/03/25',
    MM_DD_YYYY = '03/25/1998',
    DD_MM_YYYY = '25/03/1998',
    MM_DD_YY = '03/25/98',
    DD_MM_YY = '25/03/98',
}

export enum TimeFormatType {
    hh_mm_ss = '16:58:10',
    hh_mm_ss_AA = '04:58:10 PM',
}

export class CardWidget {
    data: string;
    type: string;
    constructor(type: string, data: string) {
        this.type = type;
        this.data = data;
    }
}

export enum CardWidgetType {
    view = 'card.widget-view',
    alarms = 'card.widget-alarms',
    table = 'card.widget-table',
}