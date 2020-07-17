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
    limit: number;
    deadband: number;
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