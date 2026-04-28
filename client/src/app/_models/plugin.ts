export class Plugin {
    name: string;
    type: PluginType | PluginGroupType;
    version: string;
    current: string;
    status: string;
    pkg: boolean;
    dinamic: boolean;
    group: string;
    canRemove: boolean;
}

export enum PluginType {
    OPCUA = 'OPCUA',
    BACnet = 'BACnet',
    Modbus = 'Modbus',
    Raspberry = 'Raspberry',
    SiemensS7 = 'SiemensS7',
    EthernetIP = 'EthernetIP',
    MELSEC = 'MELSEC',
    REDIS = 'REDIS'
}

export enum PluginGroupType {
    Chart = 'Chart',
    Service = 'Service'
}
