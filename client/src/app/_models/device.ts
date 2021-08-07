
export class Device {
    /** Device id, GUID */
    id: string;
    /** Device name */
    name: string;
    /** Enabled */
    enabled: boolean;
    /** Connection property, DeviceNetProperty */
    property: any;
    /** Device type, OPC, Modbus, S7, etc. */
    type: DeviceType;
    /** Polling interval, check changed value after ask value, by OPCUA there is a monitor  */
    polling: number;
    /** Tags list of Tag */
    tags: any;

    constructor(_id: string) {
        this.id = _id;
    }
}

export class Tag {
    /** Tag id, GUID */
    id: string;
    /** Tag name, is like the id  */
    name: string;
    /** Tag label, used by BACnet and WebAPI  */
    label: string;
    /** not used yet */
    value: string;
    /** Tag type, Bool, Byte, etc. */
    type: string;
    /** Address of Tag, combine with address by Modbus, some property for WebAPI */
    memaddress: string;
    /** Tag address, for OPCUA like the id */
    address: string;
    /** Value divisor, used by Modbus */
    divisor: number;
    /** not used yet */
    access: string;
    /** Options, used for WebAPI */
    options: any;
    /** not used yet */
    format: any;

    constructor(_id: string) {
        this.id = _id;
    }
}

export class DeviceNetProperty {
    /** Device address (IP) */
    address: string;
    /** Address port */
    port: string;
    /** Slot number used for Siemens S7 connection */
    slot: string;
    /** Rack number used for Siemens S7 connection */
    rack: string;
    /** Slave ID used for Modbus connection */
    slaveid: string;
    /** Serial baudrate used for Modbus RTU connection */
    baudrate: string;
    /** Serial databits used for Modbus RTU connection */
    databits: string;
    /** Serial stopbits used for Modbus RTU connection */
    stopbits: string;
    /** Serial parity used for Modbus RTU connection */
    parity: string;
    /** Options settings used for Modbus tockenized frame */
    options: string;
    /** Method flag used for WebAPI (GET/POST) */
    method: string;
    /** Data format flag used for WebAPI (CSV/JSON) */
    format: string;
}

export class DeviceSecurity {
    mode: any;
    username: string;
    password: string;
    clientId: string;
    grant_type: string;
}

export enum DeviceType {
    FuxaServer = 'FuxaServer',
    SiemensS7 = 'SiemensS7',
    OPCUA = 'OPCUA',
    BACnet = 'BACnet',
    ModbusRTU = 'ModbusRTU',
    ModbusTCP = 'ModbusTCP',
    WebAPI = 'WebAPI',
    MQTTclient = 'MQTTclient',
    WebStudio = 'WebStudio',
    internal = 'internal'
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
    NONE = '1', //'NONE',
    /** All messages are signed but not encrypted. */
    SIGN = '2', //'SIGN',
    /** All messages are signed and encrypted. */
    SIGNANDENCRYPT = '3'    //'SIGNANDENCRYPT'
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
    Basic256Sha256 = 'Basic256Sha256',
    /** see 'http://opcfoundation.org/UA/SecurityPolicy#Aes256_Sha256_RsaPss' */
    Aes256_Sha256_RsaPss = 'Aes256_Sha256_RsaPss',
    /** see ''http://opcfoundation.org/UA/SecurityPolicy#Aes128_Sha256_RsaOaep'' */
    Aes128_Sha256_RsaOaep = 'Aes128_Sha256_RsaOaep'
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

export const DEVICE_PREFIX = 'd_';
export const TAG_PREFIX = 't_';

export class DevicesUtils {
    static getDeviceFromTagId (devices: Device[], id: string): Device {
        for (let i = 0; i < devices.length; i++) {
            if (devices[i].tags[id]) {
                return devices[i];
            }
        }
        return null;
    }

    static getTagFromTagId (devices: Device[], id: string): Tag {
        for (let i = 0; i < devices.length; i++) {
            if (devices[i].tags[id]) {
                return devices[i].tags[id];
            }
        }
        return null;
    }

    static getTagFromTagAddress (device: Device, address: string): Tag {
        return <Tag>Object.values(device.tags).find((tag: Tag) => tag.address === address);
    }
}