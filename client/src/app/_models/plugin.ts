export class Plugin {
    name: string;
    type: PluginType | PluginGroupType;
    version: string;
    current: string;
    status: string;
    pkg: boolean;
    dinamic: boolean;
    group: string;
}

export enum PluginType {
    OPCUA = 'OPCUA',
    BACnet = 'BACnet',
    Modbus = 'Modbus',
    Raspberry = 'Raspberry',
    SiemensS7 = 'SiemensS7',
    EthernetIP = 'EthernetIP',
    MELSEC = 'MELSEC'
}

export enum PluginGroupType {
    Chart = 'Chart'
}
