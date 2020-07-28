export class Alarm {
    name: string;
    property: AlarmProperty;
    highhigh: AlarmSubProperty
    high: AlarmSubProperty
    low: AlarmSubProperty
    info: AlarmSubProperty
    value: string;
}
export class AlarmProperty {
    variableId: string;
    variableSrc: string;
    variable: string;
    permission: number;
}
export class AlarmSubProperty {
    enabled: boolean;
    checkdelay: number;
    min: number;
    max: number;
    timedelay: number;
    text: string;
    group: string;
    ackmode: AlarmAckMode;
    bkcolor: string;
    color: string;
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