export class Plugin {
    name: string;
    type: PluginType;
    version: string;
    current: string;
    status: string;
    pkg: boolean;
    dinamic: boolean;
}

export enum PluginType {
    OPCUA = 'OPCUA',
    BACnet = 'BACnet',
    Modbus = 'Modbus',
    Raspberry = 'Raspberry',
    SiemensS7 = 'SiemensS7',
    EthernetIP = 'EthernetIP'
}
