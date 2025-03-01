import { GridType } from 'angular-gridster2';
import { Device, DeviceType, Tag } from './device';
import { WidgetPropertyVariable } from '../_helpers/svg-utils';
import { MapsLocation } from './maps';

export class Hmi {
    /** Layout for navigation menu, header bar, ...  */
    layout: LayoutSettings = new LayoutSettings();
    /** Views list of hmi project */
    views: View[] = [];
}

export class View {
    /** View id, random number */
    id = '';
    /** View name used as reference in configuration */
    name = '';
    /** View profile size, background color */
    profile: DocProfile = new DocProfile();
    /** Gauges settings list used in the view  */
    items: DictionaryGaugeSettings = {};
    /** Variables (Tags) list used in the view */
    variables: DictionaryVariables = {};
    /** Svg code content of the view  */
    svgcontent = '';
    /** Type of view SVG/CARDS */
    type: ViewType;
    /** Property with events of view like Open or Close */
    property: ViewProperty;

    constructor(id?: string, type?: ViewType, name?: string) {
        this.id = id;
        this.name = name;
        this.type = type;
    }
}

export enum ViewType {
    svg = 'svg',
    cards = 'cards',
    maps = 'maps'
}

export class LayoutSettings {
    /** Auto resize view */
    autoresize?: boolean = false;
    /** Start view (home) */
    start = '';
    /** Left side navigation menu settings */
    navigation: NavigationSettings = new NavigationSettings();
    /** On top header settings */
    header: HeaderSettings = new HeaderSettings();
    /** Show development blue button (Home, Lab, Editor) */
    showdev = true;
    /** Enable zoom in view */
    zoom: ZoomModeType;
    /** Show input dialog for input field */
    inputdialog = 'false';
    /** Hide navigation Header and sidebarmenu */
    hidenavigation = false;
    /** GUI Theme */
    theme = '';
    /** Show login by start */
    loginonstart?: boolean = false;
    /** Overlay color for login modal */
    loginoverlaycolor?: LoginOverlayColorType = LoginOverlayColorType.none;
    /** Show connection error toast */
    show_connection_error? = true;
    /** Customs Css Styles */
    customStyles = '';
}

export class NavigationSettings {
    /** Side menu mode (over, push, fix) */
    mode: NaviModeType;
    /** Menu item show type (text, icon) */
    type: NaviItemType;
    /** Menu background color */
    bkcolor = '#F4F5F7';
    /** Menu item text and icon color */
    fgcolor = '#1D1D1D';
    /** Menu items */
    items: NaviItem[];
    /** Custom logo resource */
    logo?: boolean = false;
    constructor() {
        this.mode = Object.keys(NaviModeType).find(key => NaviModeType[key] === NaviModeType.over) as NaviModeType;
        this.type = Object.keys(NaviItemType).find(key => NaviItemType[key] === NaviItemType.block) as NaviItemType;
    }
}

export enum LoginOverlayColorType {
    none = 'none',
    black = 'black',
    white = 'white',
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
    image: string;
    permission: number;
    permissionRoles: PermissionRoles;
}

export class HeaderSettings {
    title: string;
    alarms: NotificationModeType;
    infos: NotificationModeType;
    bkcolor = '#ffffff';
    fgcolor = '#000000';
    fontFamily: string;
    fontSize = 13;
    items: HeaderItem[];
    itemsAnchor: AnchorType = 'left';
    loginInfo: LoginInfoType;
    dateTimeDisplay: string;
}

export interface HeaderItem {
    id: string;
    type: HeaderItemType;
    icon: string;
    image: string;
    bkcolor: string;
    fgcolor: string;
    marginLeft: number;
    marginRight: number;
    property: GaugeProperty;
    status: GaugeStatus;
    element: HTMLElement;
}

export type LoginInfoType = 'nothing' | 'username' | 'fullname' | 'both';

export type HeaderItemType = 'button' | 'label' | 'image';

export type AnchorType = 'left' | 'center' | 'right';

export enum NotificationModeType {
    hide = 'item.notifymode-hide',
    fix = 'item.notifymode-fix',
    float = 'item.notifymode-float',
}

export enum ZoomModeType {
    disabled = 'item.zoommode-disabled',
    enabled = 'item.zoommode-enabled',
    autoresize = 'item.zoommode-autoresize',
}

export enum InputModeType {
    false = 'item.inputmode-disabled',
    true = 'item.inputmode-enabled',
    keyboard = 'item.inputmode-keyboard',
    keyboardFullScreen = 'item.inputmode-keyboard-full-screen',
}

export enum HeaderBarModeType {
    true = 'item.headerbarmode-hide',
    false = 'item.headerbarmode-show',
}

export class DocProfile {
    width = 1024;
    height = 768;
    bkcolor = '#ffffffff';
    margin = 10;
    align = DocAlignType.topCenter;
    gridType: GridType = GridType.Fixed;
}

export enum DocAlignType {
    topCenter = 'topCenter',
    middleCenter ='middleCenter'
}

export class GaugeSettings {
    name = '';
    property: any = null;   // set to GaugeProperty after upgrate
    label = '';             // Gauge type label
    constructor(public id: string, public type: string) {
    }
}

export class ViewProperty {
    events: GaugeEvent[] = [];
    startLocation?: MapsLocation;
    startZoom?: number;
}
export class GaugeProperty {
    variableId: string;
    variableValue: string;
    bitmask: number;
    permission: number;
    permissionRoles: PermissionRoles;
    ranges: GaugeRangeProperty[];
    events: GaugeEvent[] = [];
    actions: GaugeAction[] = [];
    options: any;
    readonly: boolean;
    text: string;               // Text property (used by button)
}

export interface PermissionRoles {
    show: string[];
    enabled: string[];
}

export class WidgetProperty extends GaugeProperty {
    type: string;
    scriptContent?: { moduleId: string, content: string };
    svgContent?: string;
    varsToBind?: { [key: string]: WidgetPropertyVariable } = {};
}

export interface InputOptionsProperty {
    updated: boolean;
    numeric?: boolean;
    min?: number;
    max?: number;
    type?: InputOptionType;
    timeformat?: InputTimeFormatType;
    convertion?: InputConvertionType;
    updatedEsc?: boolean;
    selectOnClick?: boolean;
    actionOnEsc?: InputActionEscType;
}

export enum InputOptionType {
    number = 'number',
    text = 'text',
    date = 'date',
    time = 'time',
    datetime = 'datetime'
}

export enum InputTimeFormatType {
    normal = 'normal',
    seconds = 'seconds',
    milliseconds = 'milliseconds',
}

export enum InputConvertionType {
    milliseconds = 'milliseconds',
    string = 'string',
}

export enum InputActionEscType {
    update = 'update',
    enter = 'enter'
}

export interface IPropertyVariable {
    /** Tag id */
    variableId: string;
    // TODO not sure if it is necessary
    variableValue: string;
    /** Bitmask to mask with value */
    bitmask: number;
    /** Reference to tag property, used to propagate to sub component */
    variableRaw: Tag;
}
export class GaugeEvent {
    type: string;
    action: string;
    actparam: string;
    actoptions = <any>{};
}

export class ViewEvent {
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
    downup = 'shapes.action-downup',
    rotate = 'shapes.action-rotate',
    move = 'shapes.action-move',
    monitor = 'shapes.action-monitor',
}

export class GaugeAction {
    variableId: string;
    bitmask: number;
    range: GaugeRangeProperty;
    type: any;
    options: any = {};
}

export class GaugeActionBlink {
    strokeA: string = null;
    strokeB: string = null;
    fillA: string = null;
    fillB: string = null;
    interval = 1000;
}

export class GaugeActionRotate {
    minAngle = 0;
    maxAngle = 90;
    delay = 0;
}

export class GaugeActionMove {
    toX = 0;
    toY = 0;
    duration = 100;
}

export class GaugePropertyColor {
    fill: string;
    stroke: string;
}
export class GaugeStatus {
    variablesValue = {};
    onlyChange = false;         // to process value only by change
    takeValue = false;          // to process value by check change with gauge value
    actionRef: GaugeActionStatus;
}

export class GaugeActionStatus {
    type: string;
    timer?: any = null;
    animr?: any = null;
    spool?: any;
    constructor(type: string) {
        this.type = type;
    }
}

/** Gouges and Shapes mouse events */
export enum GaugeEventType {
    click = 'shapes.event-click',
    dblclick = 'shapes.event-dblclick',
    mousedown = 'shapes.event-mousedown',
    mouseup = 'shapes.event-mouseup',
    mouseover = 'shapes.event-mouseover',
    mouseout = 'shapes.event-mouseout',
    enter = 'shapes.event-enter',
    select = 'shapes.event-select',
    onLoad = 'shapes.event-onLoad',
}

export enum GaugeEventActionType {
    onpage = 'shapes.event-onpage',
    onwindow = 'shapes.event-onwindow',
    onOpenTab = 'shapes.event-onopentab',
    ondialog = 'shapes.event-ondialog',
    oniframe = 'shapes.event-oniframe',
    oncard = 'shapes.event-oncard',     // wrong name exchange with 'onwindow'
    onSetValue = 'shapes.event-onsetvalue',
    onToggleValue = 'shapes.event-ontogglevalue',
    onSetInput = 'shapes.event-onsetinput',
    onclose = 'shapes.event-onclose',
    onRunScript = 'shapes.event-onrunscript',
    onViewToPanel = 'shapes.event-onViewToPanel',
    onMonitor = 'shapes.event-onmonitor',
}

export enum ViewEventType {
    onopen = 'shapes.event-onopen',
    onclose = 'shapes.event-onclose'
}

export enum ViewEventActionType {
    onRunScript = 'shapes.event-onrunscript',
}

export enum GaugeEventRelativeFromType {
    window = 'window',
    mouse = 'mouse'
}

export enum GaugeEventSetValueType {
    set = 'shapes.event-setvalue-set',
    add = 'shapes.event-setvalue-add',
    remove = 'shapes.event-setvalue-remove',
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
    events: GaugeEvent[];
}

export interface GaugeGraphProperty {
    id: string;
    type: string;
    options: any;
}

export interface GaugeIframeProperty {
    address: string;
    variableId: string;
}

export interface GaugePanelProperty {
    viewName: string;
    variableId: string;
    scaleMode: PropertyScaleModeType;
}

export enum PropertyScaleModeType {
    none = 'none',
    contain = 'contain',
    stretch = 'stretch'
}

export interface GaugeTableProperty {
    id: string;
    type: TableType;
    options: TableOptions;
    events: GaugeEvent[];
}

export enum TableType {
    data = 'data',
    history = 'history',
    alarms = 'alarms',
    alarmsHistory = 'alarmsHistory',
    reports = 'reports',
}

export interface TableOptions {
    paginator?: {
        show: boolean;
    };
    filter?: {
        show: boolean;
    };
    daterange: {
        show: boolean;
    };
    realtime?: boolean;
    lastRange?: TableRangeType;
    gridColor?: string;
    header?: {
        show: boolean;
        height: number;
        fontSize?: number;
        color?: string;
        background?: string;
    };
    row?: {
        height: number;
        fontSize?: number;
        color?: string;
        background?: string;
    };
    selection?: {
        fontBold?: boolean;
        color?: string;
        background?: string;
    };
    columns?: TableColumn[];
    alarmsColumns?: TableColumn[];
    alarmFilter: TableFilter;
    reportsColumns?: TableColumn[];
    reportFilter: TableFilter;
    rows?: TableRow[];
}

export interface TableFilter {
    filterA: string[];
    filterB?: string[];
    filterC?: string[];
}

export enum TableCellType {
    label = 'label',
    variable = 'variable',
    timestamp = 'timestamp',
    device = 'device',
}

export class TableCell {
    id: string;
    label: string;
    variableId: string;
    valueFormat: string;
    bitmask: number;
    type: TableCellType;

    constructor(id: string, type?: TableCellType, label?: string) {
        this.id = id;
        this.type = type || TableCellType.label;
        this.label = label;
    }
}

export class TableColumn extends TableCell {
    align: TableCellAlignType = TableCellAlignType.left;
    width = 100;
    exname: string;
    constructor(name: string, type?: TableCellType, label?: string) {
        super(name, type, label);
    }
}

export class TableRow {
    cells: TableCell[];
    constructor(cls: TableCell[]) {
        this.cells = cls;
    }
}

export enum TableCellAlignType {
    left = 'left',
    center = 'center',
    right = 'right',
}

export enum TableRangeType {
    last1h = 'table.rangetype-last1h',
    last1d = 'table.rangetype-last1d',
    last3d = 'table.rangetype-last3d',
}

export class Variable {
    id: string;
    name: string;
    source: string;
    value: string;
    error: number;
    timestamp: number;
    device?: Device;
    constructor(id: string, name: string, device?: Device) {
        this.id = id;
        this.name = name;
        this.device = device;
        if (device?.type === DeviceType.internal) {
            this.value = '0';
        }
    }
}

export class VariableRange {
    min: number;
    max: number;
}

export class Alarm extends Tag {
    group: string;
    device: string;
}

export class WindowLink {
    name = '';
    title = '';
    type: string;
}

export class SelElement {
    type = '';
    id: string;
    ele: any = null;
}

export class Event {
    id = '';
    dom: any;
    value: any = null;
    dbg = '';
    type?: string;
    ga: GaugeSettings;
    variableId: string;
}

export class DaqQuery {
    gid?: string;
    from: any;
    to: any;
    event?: string;
    sids: string[];
    chunked?: boolean;
}

export interface DaqValue {
    id: string;
    ts: number;
    value: any;
}

export class DaqResult {
    gid: string;
    result: any;
    chunk?: DaqChunkType;
}

export interface DaqChunkType {
    index: number;
    of: number;
}

export class HelpData {
    page: string;
    tag: string;
}

export class Size {
    height: number;
    width: number;
    constructor(h: number, w: number) {
        this.height = h;
        this.width = w;
    }
}

export interface DictionaryGaugeSettings {
    [x: string]: GaugeSettings;
}

export interface DictionaryVariables {
    [id: string]: Variable;
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
    zoom = 1;
    scaleMode: PropertyScaleModeType;

    constructor(type: string, data: string) {
        this.type = type;
        this.data = data;
    }
}

export enum CardWidgetType {
    view = 'view',
    alarms = 'alarms',
    iframe = 'iframe',
    table = 'table',
}

export enum LinkType {
    address = '[link]',
    alarms = '[alarms]',
}

export const DEVICE_READONLY = 'rodevice';

export interface IDateRange {
    start;
    end;
}

export interface ISvgElement {
    id: string;
    name: string;
}
