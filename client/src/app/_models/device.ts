
export class Device {
    id: string;
    name: string;
    enabled: boolean;
    property: any;
    type: DeviceType;
    tags: any;
}

export class Tag {
    name: string;
    value: string;
    type: string;
    address: string;
    min: string;
    max: string;
}

export class DeviceNetProperty {
    address: string;
    port: string;
    slot: string;
    rack: string;
}

export enum DeviceType {
    FuxaServer = 'FuxaServer',
    SiemensS7 = 'SiemensS7'
}

export enum TagType {
    Boolean = 'Bool',
    Byte = 'Byte',
    Integer = 'Integer',
    Word = 'Word',
    DInteger = 'DInteger',
    DWord = 'DWord',
    Real = 'Real'
}