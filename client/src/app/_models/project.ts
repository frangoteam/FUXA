import { Device, DEVICE_PREFIX } from './device';
import { Hmi } from './hmi';
import { Chart } from './chart';
import { Graph } from './graph';
import { Alarm } from './alarm';
import { Notification } from './notification';
import { Languages, LanguageText } from './language';
import { Utils } from '../_helpers/utils';
import { Script } from './script';
import { Report } from './report';
import { MapsLocation } from './maps';
import { ClientAccess } from './client-access';

export class ProjectData {
    version = '1.01';
    /** Project name */
    name?: string;
    /** FUXA Server */
    server: Device = new Device(Utils.getGUID(DEVICE_PREFIX));
    /** Hmi resource, layout, SVG, etc. */
    hmi: Hmi = new Hmi();
    /** Devices, connection, Tags, etc. */
    devices = {};
    /** Charts, Tags, colors, etc. */
    charts: Chart[] = [];
    /** Graphs, Bar, Pie */
    graphs: Graph[] = [];
    /** Alarms, Tags, logic, level, colors, etc.  */
    alarms: Alarm[] = [];
    /** Notifications  */
    notifications: Notification[] = [];
    /** Scripts */
    scripts: Script[] = [];
    /** Reports */
    reports: Report[] = [];
    /** Texts */
    texts: LanguageText[] = [];
    /** Language */
    languages: Languages = new Languages();
    /** Plugins, name, version */
    plugin: Plugin[] = [];
    /** Maps location */
    mapsLocations: MapsLocation[] = [];
    /** ClientAccess */
    clientAccess = new ClientAccess();
}

export enum ProjectDataCmdType {
    SetDevice = 'set-device',
    DelDevice = 'del-device',
    SetView = 'set-view',
    DelView = 'del-view',
    HmiLayout = 'layout',
    Charts = 'charts',
    Graphs = 'graphs',
    Languages = 'languages',
    ClientAccess = 'client-access',
    SetText = 'set-text',
    DelText = 'del-text',
    SetAlarm = 'set-alarm',
    DelAlarm = 'del-alarm',
    SetNotification = 'set-notification',
    DelNotification = 'del-notification',
    SetScript = 'set-script',
    DelScript = 'del-script',
    SetReport = 'set-report',
    DelReport = 'del-report',
    SetMapsLocation = 'set-maps-location',
    DelMapsLocation = 'del-maps-location',
}


export class UploadFile {
    location: string;
}
