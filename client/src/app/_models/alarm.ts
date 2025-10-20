import { Utils } from '../_helpers/utils';

export class Alarm {
    name: string;
    property: AlarmProperty;
    highhigh: AlarmSubProperty;
    high: AlarmSubProperty;
    low: AlarmSubProperty;
    info: AlarmSubProperty;
    actions: AlarmSubActions;
    value: string;
}

export enum AlarmsType {
    HIGH_HIGH = 'highhigh',
    HIGH = 'high',
    LOW = 'low',
    INFO = 'info'
}

export class AlarmProperty {
    variableId: string;
    permission: number;
    permissionRoles: {
        show: string[];
        enabled: string[];
    };
}

export class AlarmStatus {
    highhigh: number;
    high: number;
    low: number;
    info: number;
    actions: any[];
}

export class AlarmSubRange {
    checkdelay: number;
    min: number;
    max: number;
    timedelay: number;

    static isValid(asr: AlarmSubRange): boolean {
        if (asr && asr.checkdelay && Utils.isNumeric(asr.min) && Utils.isNumeric(asr.max)) {
            return true;
        }
        return false;
    }
}

export class AlarmSubProperty extends AlarmSubRange {
    enabled: boolean;
    text: string;
    group: string;
    ackmode: AlarmAckMode;
    bkcolor: string;
    color: string;
}

export class AlarmSubActions {
    enabled: boolean;
    values: AlarmAction[] = [];

    static isValid(act: AlarmSubActions): boolean {
        if (act.values.length) {
            for (let i = 0; i < act.values.length; i++) {
                if (AlarmSubRange.isValid(act.values[i])) {
                    return true;
                }
            }
        }
        return false;
    }
}

export class AlarmAction extends AlarmSubRange {
    type: AlarmActionsType;
    actparam: any;
    variableId: any;
    actoptions = {};
}

export enum AlarmAckMode {
    float = 'alarm.ack-float',
    ackactive = 'alarm.ack-active',
    ackpassive = 'alarm.ack-passive',
}
export class AlarmEvent {
    ontime: string;
    offtime: string;
    acktime: string;
    name: string;
    type: string;
    text: string;
    group: string;
    status: string;
    toack: boolean;
}

export class AlarmQuery {
    start: Date;
    end: Date;
}

export enum AlarmColumnsType {
    ontime = 'ontime',
    text = 'text',
    type =  'type',
    group = 'group',
    status = 'status',
    ack = 'ack',
    history = 'history'
}
export const AlarmColumns: string[] = Object.values(AlarmColumnsType);

export enum AlarmHistoryColumnsType {
    ontime = 'ontime',
    text = 'text',
    type = 'type',
    group = 'group',
    status = 'status',
    offtime = 'offtime',
    acktime = 'acktime',
    userack = 'userack',
    history = 'history'
}
export const AlarmHistoryColumns: string[] = Object.values(AlarmHistoryColumnsType);

export interface AlarmBaseType {
    type: string;
    name: string;
    status: string;
    text: string;
    ontime: number;
    offtime: number;
    acktime: number;
    userack: number;
    group: string;
    bkcolor: string;
    color: string;
    toack: boolean;
}

export enum AlarmActionsType {
    popup = 'alarm.action-popup',
    setView = 'alarm.action-onsetview',
    setValue = 'alarm.action-onsetvalue',
    runScript = 'alarm.action-onRunScript',
    toastMessage = 'alarm.action-toastMessage'
    // sendMsg = 'alarm.action-onsendmsg',
}

export enum AlarmPropertyType {
    ontime = 'ontime',
    text = 'text',
    type = 'type',
    group = 'group',
    status = 'status',
    offtime = 'offtime',
    acktime = 'acktime',
    ackuser = 'userack',
}

export enum AlarmStatusType {
    N = 'alarm.status-active',
    NF = 'alarm.status-passive',
    NA = 'alarm.status-active-ack',
}

export enum AlarmPriorityType {
    highhigh = 'alarm.property-highhigh',
    high = 'alarm.property-high',
    low = 'alarm.property-low',
    info = 'alarm.property-info'
}

export interface AlarmsFilter {
    priority: string[],
    text: string;
    group: string;
    tagIds: string[];
}
