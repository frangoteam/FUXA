
export class Device {
    id: string;
    name: string;
    enabled: boolean;
    property: any;
    type: DeviceType;
    tags: any;
}

export class Tag {
    id: string;
    name: string;
    label: string;
    value: string;
    type: string;
    memaddress: string;
    address: string;
    min: string;
    max: string;
    access: string;
}

export class DeviceNetProperty {
    address: string;
    port: string;
    slot: string;
    rack: string;
    slaveid: string;
    baudrate: string;
    databits: string;
    stopbits: string;
    parity: string;
    options: string;
}

export class DeviceSecurity {
    mode: any;
    username: string;
    password: string;
}

export enum DeviceType {
    FuxaServer = 'FuxaServer',
    SiemensS7 = 'SiemensS7',
    OPCUA = 'OPCUA',
    BACnet = 'BACnet',
    ModbusRTU = 'ModbusRTU',
    ModbusTCP = 'ModbusTCP'
}

export enum TagType {
    Bool = 'Bool',
    Byte = 'Byte',
    Int = 'Int',
    Word = 'Word',
    DInt = 'DInt',
    DWord = 'DWord',
    Real = 'Real'
}

export enum ModbusTagType {
    Bool = 'Bool',
    Int16 = 'Int16',
    UInt16 = 'UInt16',
    Int32 = 'Int32',
    UInt32 = 'UInt32',
    Float32 = 'Float32',
    Float64 = 'Float64'
    // String = 'String'
}

export enum MessageSecurityMode {
    /** The MessageSecurityMode is invalid */
    INVALID,
    /** No security is applied. */
    NONE = 'NONE',
    /** All messages are signed but not encrypted. */
    SIGN = 'SIGN',
    /** All messages are signed and encrypted. */
    SIGNANDENCRYPT = 'SIGNANDENCRYPT'
}

export enum SecurityPolicy {
    /** see http://opcfoundation.org/UA/SecurityPolicy#None */
    None = 'None',
    /** see http://opcfoundation.org/UA/SecurityPolicy#Basic128 */
    Basic128 = 'Basic128',
    /** see http://opcfoundation.org/UA/SecurityPolicy#Basic128Rsa15 */
    Basic128Rsa15 = 'Basic128Rsa15',
    /** see http://opcfoundation.org/UA/SecurityPolicy#Basic192 */
    Basic192 = 'Basic192',
    /** see http://opcfoundation.org/UA/SecurityPolicy#Basic192Rsa15 */
    Basic192Rsa15 = 'Basic192Rsa15',
    /** see http://opcfoundation.org/UA/SecurityPolicy#Basic256 */
    Basic256 = 'Basic256',
    /** see http://opcfoundation.org/UA/SecurityPolicy#Basic256Rsa15 */
    Basic256Rsa15 = 'Basic256Rsa15',
    /** see http://opcfoundation.org/UA/SecurityPolicy#Basic256Sha25 */
    Basic256Sha256 = 'Basic256Sha256'
}

export enum BACnetObjectType {
    ANALOG_INPUT = 'Analog Input',              // 0
    ANALOG_OUTPUT = 'Analog Output',            // 1
    ANALOG_VALUE = 'Analog Value',              // 2
    BINARY_INPUT = 'Binary Input',              // 3
    BINARY_OUTPUT = 'Binary Output',            // 4
    BINARY_VALUE = 'Binary Value',              // 5
    CALENDAR = '',                              // 6
    COMMAND = '',                               // 7
    DEVICE = ''                                 // 8
}