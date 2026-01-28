import { Utils } from '../_helpers/utils';
import { Script } from './script';

export const FuxaServer = {
    id: '0',
    name: 'FUXA'
};

export const PlaceholderDevice = {
    id: '@',
    name: 'Placeholder',
    tags: [{
        id: '@',
        name: '@',
        device: '@'
    }]
};

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
    tags: DictionaryTag;

    constructor(_id: string) {
        this.id = _id;
    }

    static descriptor = {
        id: 'Device id, GUID',
        name: 'Device name',
        enabled: 'Enabled',
        type: 'Device Type: FuxaServer | SiemensS7 | OPCUA | BACnet | ModbusRTU | ModbusTCP | WebAPI | MQTTclient | internal | EthernetIP | ADSclient | Gpio | WebCam | MELSEC | REDIS | EPICS',
        polling: 'Polling interval in millisec., check changed value after ask value, by OPCUA there is a monitor',
        property: 'Connection property depending of type',
        tags: 'Tags list of Tag',
    };

    static isWebApiProperty(device: Device): boolean {
        return device.type === DeviceType.WebAPI && device.property.getTags;
    }
}

interface DictionaryTag {
    [id: string]: Tag;
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
    /** Tag address, for OPCUA like the id , for GPIO the io number */
    address: string;
    /** Value divisor, used by Modbus */
    divisor: number;
    /** not used yet */
    access: string;
    /** Options, used for WebAPI and MQTT */
    options: any;
    /** Digits format of value, number of digits to appear after the decimal point */
    format: number;
    /** Daq settings */
    daq: TagDaq;
    /** Init value */
    init: string;
    /** Value scaling properties */
    scale: TagScale;
    /** Scale function to use when reading tag */
    scaleReadFunction?: string;
    /** Optional JSON encoded params and values for above script */
    scaleReadParams?: string;
    /** Scale function to use when writing tag */
    scaleWriteFunction?: string;
    /** Optional JSON encoded params and values for above script */
    scaleWriteParams?: string;
    /** System Tag used in FUXA Server, example device status connection */
    sysType: TagSystemType;
    /** Description */
    description?: string;
    /** Deadband to set changed value */
    deadband?: TagDeadband;
    /**
     * Optional GPIO direction,edge
     */
    direction?: string;
    edge?: string;
    /**
     * Optional EPICS monitor flag, if true use real-time monitor mode
     */
    monitor?: boolean;


    constructor(_id: string) {
        this.id = _id;
        this.daq = new TagDaq(false, false, 60, false);
    }

    static descriptor = {
        id: 'Tag id, GUID',
        name: 'Tag name, is like the id',
        label: 'Tag label, used by BACnet and WebAPI',
        type: 'Tag type, Bool, Byte, etc. depending of device type',
        memaddress: 'Address of Tag, combine with address by Modbus, some property for WebAPI',
        address: 'Tag address, for OPCUA like the id',
        divisor: 'Value divisor, used by Modbus',
        options: 'Options is a string JSON object, used for WebAPI and MQTT, pubs: items to publish | subs: items to subscribe',
        init: 'Init value',
        daq: {
            enabled: 'Daq enabled storage',
            interval: 'min storage interval (without change value)'
        },
        format: 'Number of digits to appear after the decimal point',
        direction: 'A string specifying whether the GPIO should be configured as an input or output. The valid values are: \'in\', \'out\', \'high\', and \'low\'. If \'out\' is specified the GPIO will be configured as an output and the value of the GPIO will be set to 0. \'high\' and \'low\' are variants of \'out\' that configure the GPIO as an output with an initial level of 1 or 0 respectively.',
        edge: 'An optional string specifying the interrupt generating edge or edges for an input GPIO. The valid values are: \'none\', \'rising\', \'falling\' or \'both\'. The default value is \'none\' indicating that the GPIO will not generate interrupts. Whether or not interrupts are supported by an input GPIO is GPIO specific. If interrupts are not supported by a GPIO the edge argument should not be specified. The edge argument is ignored for output GPIOs.',
        monitor: 'A boolean flag for EPICS tags indicating whether to use real-time monitor mode. If true, the EPICS Channel Access client will subscribe to PV changes and receive updates in real-time. If false or undefined, the tag will be polled at regular intervals.',
    };
}

export interface TagDevice extends Tag {
    deviceId?: string;
    deviceName?: string;
    deviceType?: DeviceType;
}
export class TagDaq {
    /** DAQ data acquisition is enabled */
    enabled: boolean;
    /** Fix interval to save the current value in seconds*/
    interval: number;
    /** Save if the value was changed, the check is in device polling interval */
    changed: boolean;
    /** Restore withe the last saved value on start device */
    restored = false;

    constructor(_enabled: boolean, _changed: boolean, _interval: number, _restored?: boolean) {
        this.enabled = _enabled;
        this.changed = _changed;
        this.interval = _interval;
        this.restored = _restored;
    }
}

export interface TagDeadband {
    value: number;
    mode: TagDeadbandModeType;
}

export enum TagDeadbandModeType {
    absolute = 'absolute'
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
    /** Options settings used for Modbus tockenized frame, redis for field */
    options: string;
    /** Method flag used for WebAPI (GET/POST) */
    method: string;
    /** Data format flag used for WebAPI (CSV/JSON) */
    format: string;
    /** Connection option used for Modbus RTU/TCP, Redis for readMode */
    connectionOption: string;
    /** Delay used for Modbus RTU/TCP delay between frame*/
    delay: number = 10;
    /** Modbus TCP socket reuse flag */
    socketReuse?: string;
    /** Force FC16 for Modbus RTU/TCP write operations */
    forceFC16?: boolean;
    /** MELSEC */
    ascii?: boolean;
    octalIO?: boolean;

    static descriptor = {
        address: 'Device address (IP)',
        // port: 'Address port',
        // slot: 'Slot number used for Siemens S7 connection',
        // rack: 'Rack number used for Siemens S7 connection',
        // slaveid: 'Slave ID used for Modbus connection',
        // baudrate: 'Serial baudrate used for Modbus RTU connection',
        // databits: 'Serial databits used for Modbus RTU connection',
        // stopbits: 'Serial stopbits used for Modbus RTU connection',
        // parity: 'Serial parity used for Modbus RTU connection',
        // options: 'Options settings used for Modbus tockenized frame if "true" frames without unassigned address. In EthernetIP routing rack/slot',
        // method: 'Method flag used for WebAPI (GET/POST)',
        // format: 'Data format flag used for WebAPI (CSV/JSON)',
    };
}

export class DeviceWebApiProperty {
    /** Get Tags URL */
    getTags: string;
    /** Port Tags URL */
    postTags: string;
}

export class DeviceSecurity {
    mode: any;
    username: string;
    password: string;
    clientId: string;
    grant_type: string;
    certificateFileName: string;
    privateKeyFileName: string;
    caCertificateFileName: string;
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
    internal = 'internal',
    EthernetIP = 'EthernetIP',
    ODBC = 'ODBC',
    ADSclient = 'ADSclient',
    GPIO = 'GPIO',
    WebCam = 'WebCam',
    MELSEC = 'MELSEC',
    REDIS = 'REDIS',
    EPICS = 'EPICS'
    // Template: 'template'
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
    Float64 = 'Float64',
    Int64 = 'Int64',
    Int16LE = 'Int16LE',
    UInt16LE = 'UInt16LE',
    Int32LE = 'Int32LE',
    UInt32LE = 'UInt32LE',
    Float32LE = 'Float32LE',
    Float64LE = 'Float64LE',
    Float64MLE = 'Float64MLE',
    Int64LE = 'Int64LE',
    Float32MLE = 'Float32MLE',
    Int32MLE = 'Int32MLE',
    UInt32MLE = 'UInt32MLE'
    // String = 'String'
}

export enum OpcUaTagType {
    Boolean = 'Boolean',
    SByte = 'SByte',
    Byte = 'Byte',
    Int16 = 'Int16',
    UInt16 = 'UInt16',
    Int32 = 'Int32',
    UInt32 = 'UInt32',
    Int64 = 'Int64',
    UInt64 = 'UInt64',
    Float = 'Float',
    Double = 'Double',
    String = 'String',
    DateTime = 'DateTime',
    Guid = 'Guid',
    ByteString = 'ByteString'
}

export enum AdsClientTagType {
    Number = 'number',
    Boolean = 'boolean',
    String = 'string'
}

export enum MelsecTagType {
    BOOL = 'BOOL',
    BYTE = 'BYTE',
    WORD = 'WORD',
    INT = 'INT',
    UINT = 'UINT',
    DINT = 'DINT',
    UDINT = 'UDINT',
    REAL = 'REAL',
    STRING = 'STRING'
}

export enum RedisReadModeType {
    simple = 'simple',
    hash = 'hash',
    // custom = 'custom',
}

export enum RedisTagType {
    number = 'number',
    boolean = 'boolean',
    string = 'string'
}

export class RedisOptions {
    redisTimeoutMs: number = 3000;
    maxKeysPerPoll = 500;
    readFields = {
        value: '',
        quality: '',
        timestamp: ''
      };
    customCommand = {
        read: {
            name: '',
            batchPerKey: true,
            args: ['{{key}}','{{fields...}}']
          },
        write: {
            name: '',
            args: []
          }
    };
}

export enum ModbusOptionType {
    SerialPort = 'SerialPort',
    RTUBufferedPort = 'RTUBufferedPort',
    AsciiPort = 'AsciiPort',
    TcpPort = 'TcpPort',
    UdpPort = 'UdpPort',
    TcpRTUBufferedPort = 'TcpRTUBufferedPort',
    TelnetPort = 'TelnetPort'
}

export enum ModbusReuseModeType {
    Reuse = 'Reuse',
    ReuseSerial = 'ReuseSerial',
}

/**
 * A string specifying whether the GPIO should be configured as an input or output. The valid values are: 'in', 'out', 'high', and 'low'. If 'out' is specified the GPIO will be configured as an output and the value of the GPIO will be set to 0. 'high' and 'low' are variants of 'out' that configure the GPIO as an output with an initial level of 1 or 0 respectively.
 */
export enum GpioDirectionType {
    in = 'in',
    out = 'out',
    high = ' - high',
    low = ' - low',
}

/**
 * An optional string specifying the interrupt generating edge or edges for an input GPIO. The valid values are: 'none', 'rising', 'falling' or 'both'. The default value is 'none' indicating that the GPIO will not generate interrupts. Whether or not interrupts are supported by an input GPIO is GPIO specific. If interrupts are not supported by a GPIO the edge argument should not be specified. The edge argument is ignored for output GPIOs.
 */
export enum GpioEdgeType {
    none = 'none',
    rising = 'rising',
    falling = 'falling',
    both = 'both',
}

/**
 * EPICS Tag data types
 */
export enum EpicsTagType {
    String = 'string',
    Number = 'number',
    Boolean = 'boolean'
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
    static getDeviceTagText(devices: Device[], id: string): string {
        for (let i = 0; i < devices.length; i++) {
            if (devices[i].tags[id]) {
                return `${devices[i].name} - ${devices[i].tags[id].name}`;
            }
        }
        return '';
    }

    static getDeviceFromTagId(devices: Device[], id: string): Device {
        for (let i = 0; i < devices.length; i++) {
            if (devices[i].tags[id]) {
                return devices[i];
            }
        }
        return null;
    }

    static getTagFromTagId(devices: Device[], id: string): Tag {
        for (let i = 0; i < devices.length; i++) {
            if (devices[i].tags[id]) {
                return devices[i].tags[id];
            }
        }
        return null;
    }

    static getTagFromTagAddress(device: Device, address: string): Tag {
        return <Tag>Object.values(device.tags).find((tag: Tag) => tag.address === address);
    }

    //#region Converter
    static readonly columnDelimiter = ',';
    static readonly lineDelimiter = '\n';
    static readonly lineComment = '#';
    static readonly lineDevice = 'D@';
    static readonly lineTag = 'T@';
    static readonly lineSectionHeader = '@';
    static readonly columnMaske = '~';

    private static unmaskCsvValue(value: string): string {
        return value.replace(new RegExp(DevicesUtils.columnMaske, 'g'), DevicesUtils.columnDelimiter);
    }

    private static formatCsvValue(value: any): string {
        if (value === null || value === undefined) {
            return '';
        }
        let text = '';
        if (typeof value === 'function') {
            text = value.name || '';
            return text.replace(new RegExp(DevicesUtils.columnDelimiter, 'g'), DevicesUtils.columnMaske);
        }
        if (typeof value === 'object') {
            try {
                text = JSON.stringify(value);
            } catch (err) {
                text = value.toString();
            }
        } else {
            text = value.toString();
        }
        return text.replace(new RegExp(DevicesUtils.columnDelimiter, 'g'), DevicesUtils.columnMaske);
    }

    private static isBooleanKey(key: string): boolean {
        return key === 'enabled'
            || key.endsWith('.enabled')
            || key.endsWith('.changed')
            || key.endsWith('.restored')
            || key.endsWith('.forceFC16')
            || key.endsWith('.ascii')
            || key.endsWith('.octalIO');
    }

    private static isNumberKey(key: string): boolean {
        return key === 'polling'
            || key === 'divisor'
            || key === 'format'
            || key === 'sysType'
            || key.endsWith('.interval')
            || key.endsWith('.delay');
    }

    private static parseCsvValueForKey(key: string, value: string): any {
        const text = DevicesUtils.unmaskCsvValue(value);
        if (text === '') {
            return '';
        }
        const jsonCandidate = text.trim();
        if ((jsonCandidate.startsWith('{') || jsonCandidate.startsWith('[')) && Utils.isJson(jsonCandidate)) {
            try {
                return JSON.parse(jsonCandidate);
            } catch (err) {
            }
        }
        if (DevicesUtils.isBooleanKey(key)) {
            return Utils.Boolify(text);
        }
        if (DevicesUtils.isNumberKey(key)) {
            const parsed = parseFloat(text);
            return Number.isNaN(parsed) ? text : parsed;
        }
        return text;
    }

    private static getScriptNameByIdMap(scripts?: Script[]): { [key: string]: string } {
        const map: { [key: string]: string } = {};
        if (!scripts) {
            return map;
        }
        scripts.forEach(script => {
            if (script?.id && script?.name) {
                map[script.id] = script.name;
            }
        });
        return map;
    }

    private static getScriptIdByNameMap(scripts?: Script[]): { [key: string]: string } {
        const map: { [key: string]: string } = {};
        if (!scripts) {
            return map;
        }
        scripts.forEach(script => {
            if (script?.id && script?.name) {
                map[script.name] = script.id;
            }
        });
        return map;
    }

    private static resolveScriptName(value: string, scriptNameById?: { [key: string]: string }): string {
        if (!value || !scriptNameById) {
            return value;
        }
        return scriptNameById[value] ?? value;
    }

    private static resolveScriptId(value: string, scriptIdByName?: { [key: string]: string }): string {
        if (!value || !scriptIdByName) {
            return value;
        }
        return scriptIdByName[value] ?? value;
    }

    private static setNestedValue(target: any, key: string, value: any) {
        if (!key.includes('.')) {
            target[key] = value;
            return;
        }
        const parts = key.split('.');
        let current = target;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) {
                current[parts[i]] = {};
            }
            current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = value;
    }

    private static collectDeviceKeys(devices: Device[]): { deviceKeys: string[]; propertyKeys: string[] } {
        const baseDeviceKeys = Object.keys(Device.descriptor).filter(k => k !== 'tags' && k !== 'property');
        const extraDeviceKeys = new Set<string>();
        const basePropertyKeys = Object.keys(DeviceNetProperty.descriptor);
        const extraPropertyKeys = new Set<string>();

        devices.forEach(device => {
            if (!device) {
                return;
            }
            Object.keys(device).forEach(key => {
                if (key === 'tags' || key === 'property') {
                    return;
                }
                if (!baseDeviceKeys.includes(key)) {
                    extraDeviceKeys.add(key);
                }
            });
            if (device.property) {
                Object.keys(device.property).forEach(key => {
                    if (!basePropertyKeys.includes(key)) {
                        extraPropertyKeys.add(key);
                    }
                });
            }
        });

        return {
            deviceKeys: [...baseDeviceKeys, ...Array.from(extraDeviceKeys).sort()],
            propertyKeys: [...basePropertyKeys, ...Array.from(extraPropertyKeys).sort()]
        };
    }

    private static collectTagKeys(devices: Device[]): { tagKeys: string[]; daqKeys: string[] } {
        const baseTagKeys = Object.keys(Tag.descriptor).filter(k => k !== 'daq' && k !== 'options');
        const extraTagKeys = new Set<string>();
        const extraDaqKeys = new Set<string>();

        devices.forEach(device => {
            if (!device?.tags) {
                return;
            }
            const tags = <Tag[]>Object.values(device.tags);
            tags.forEach(tag => {
                if (!tag) {
                    return;
                }
                Object.keys(tag).forEach(key => {
                    if (key === 'daq' || key === 'options' || key === 'value' || key === 'timestamp') {
                        return;
                    }
                    if (!baseTagKeys.includes(key)) {
                        extraTagKeys.add(key);
                    }
                });
                if (tag.daq) {
                    Object.keys(tag.daq).forEach(key => {
                        if (key === 'enabled' || key === 'interval') {
                            return;
                        }
                        extraDaqKeys.add(key);
                    });
                }
            });
        });

        return {
            tagKeys: [...baseTagKeys, ...Array.from(extraTagKeys).sort()],
            daqKeys: ['enabled', 'interval', ...Array.from(extraDaqKeys).sort()]
        };
    }

    private static parseHeaderKeys(line: string): string[] {
        const items = line.split(DevicesUtils.columnDelimiter);
        return items.slice(1).filter(item => item !== '');
    }

    private static mapLineToData(line: string, headerKeys: string[]): any {
        const items = line.split(DevicesUtils.columnDelimiter);
        const values = items.slice(1);
        const data: any = {};
        headerKeys.forEach((key, index) => {
            if (index < values.length) {
                data[key] = DevicesUtils.parseCsvValueForKey(key, values[index]);
            }
        });
        return data;
    }

    /**
     * converter of devices array to CSV format
     * @param devices
     * @param scripts
     * @returns
     */
    static devicesToCsv(devices: Device[], scripts?: Script[]): string {
        let result = '';
        const scriptNameById = DevicesUtils.getScriptNameByIdMap(scripts);
        // devices list
        let devicesHeaderDescription = `!! CSV separator property convertion to "~"${DevicesUtils.lineDelimiter}`;
        let devicesHeader = `${DevicesUtils.lineSectionHeader}header${DevicesUtils.columnDelimiter}`;
        let devicesData = '';
        const deviceKeysInfo = DevicesUtils.collectDeviceKeys(devices);
        const dkeys = deviceKeysInfo.deviceKeys;
        const pkeys = deviceKeysInfo.propertyKeys;
        dkeys.forEach(hk => {
            const descriptor = Device.descriptor[hk] || 'dynamic device field';
            devicesHeaderDescription += `${DevicesUtils.lineComment}${hk}${DevicesUtils.columnDelimiter}: ${descriptor}${DevicesUtils.lineDelimiter}`;
            devicesHeader += `${hk}${DevicesUtils.columnDelimiter}`;
        });
        pkeys.forEach(pk => {
            const descriptor = DeviceNetProperty.descriptor[pk] || 'dynamic property field';
            devicesHeaderDescription += `${DevicesUtils.lineComment}property.${pk}${DevicesUtils.columnDelimiter}: ${descriptor}${DevicesUtils.lineDelimiter}`;
            devicesHeader += `property.${pk}${DevicesUtils.columnDelimiter}`;
        });
        // device data
        for (let i = 0; i < devices.length; i++) {
            devicesData += DevicesUtils.device2Line(devices[i], dkeys, pkeys);
            devicesData += `${DevicesUtils.lineDelimiter}`;
        }
        result += `${devicesHeaderDescription}${DevicesUtils.lineDelimiter}`;
        result += `${devicesHeader}${DevicesUtils.lineDelimiter}${devicesData}`;
        result += `${DevicesUtils.lineDelimiter}`;

        // tags of devices
        let tagsHeaderDescription = '';
        let tagsHeader = '';
        let tagsData = '';
        const tagKeysInfo = DevicesUtils.collectTagKeys(devices);
        const tkeys = tagKeysInfo.tagKeys;
        const daqKeys = tagKeysInfo.daqKeys;
        tagsHeaderDescription += `${DevicesUtils.lineComment}deviceId${DevicesUtils.columnDelimiter}:Reference to device${DevicesUtils.lineDelimiter}`;
        tagsHeader += `${DevicesUtils.lineSectionHeader}header${DevicesUtils.columnDelimiter}deviceId${DevicesUtils.columnDelimiter}`;
        tkeys.forEach(tk => {
            const descriptor = Tag.descriptor[tk] || 'dynamic tag field';
            tagsHeaderDescription += `${DevicesUtils.lineComment}${tk}${DevicesUtils.columnDelimiter}: ${descriptor}${DevicesUtils.lineDelimiter}`;
            tagsHeader += `${tk}${DevicesUtils.columnDelimiter}`;
        });
        tagsHeaderDescription += `${DevicesUtils.lineComment}options${DevicesUtils.columnDelimiter}: ${Tag.descriptor.options}${DevicesUtils.lineDelimiter}`;
        tagsHeader += `options${DevicesUtils.columnDelimiter}`;
        daqKeys.forEach(dk => {
            const descriptor = Tag.descriptor?.daq?.[dk] || 'dynamic daq field';
            tagsHeaderDescription += `${DevicesUtils.lineComment}daq.${dk}${DevicesUtils.columnDelimiter}: ${descriptor}${DevicesUtils.lineDelimiter}`;
            tagsHeader += `daq.${dk}${DevicesUtils.columnDelimiter}`;
        });

        for (let i = 0; i < devices.length; i++) {
            if (devices[i].tags) {
                const tags = <Tag[]>Object.values(devices[i].tags);
                for (let y = 0; y < tags.length; y++) {
                    tagsData += DevicesUtils.tag2Line(tags[y], devices[i].id, tkeys, daqKeys, scriptNameById);
                    tagsData += `${DevicesUtils.lineDelimiter}`;
                }
            }
            tagsData += `${DevicesUtils.lineDelimiter}`;
        }
        result += `${tagsHeaderDescription}${DevicesUtils.lineDelimiter}`;
        result += `${tagsHeader}${DevicesUtils.lineDelimiter}${tagsData}`;
        result += `${DevicesUtils.lineDelimiter}`;
        return result;
    }

    /**
     * convert string source of CSV to Device array
     * @param source
     * @param scripts
     */
    static csvToDevices(source: string, scripts?: Script[]): Device[] {
        try {
            // Device keys length to check, without tags and DeviceNetProperty instead of property
            const deviceKeyLength = Object.keys(Device.descriptor).length + Object.keys(DeviceNetProperty.descriptor).length;
            // Tags keys length to check, with daq splitted in enabled and interval
            const tagKeyLength = Object.keys(Tag.descriptor).length + 4;
            let devices = {};
            let deviceHeaderKeys: string[] = null;
            let tagHeaderKeys: string[] = null;
            const scriptIdByName = DevicesUtils.getScriptIdByNameMap(scripts);
            const lines = source.split(DevicesUtils.lineDelimiter);
            lines.forEach((line) => {
                if (!line) {
                    return;
                }
                if (line.startsWith(DevicesUtils.lineComment)) {
                    return;
                }
                if (line.startsWith(DevicesUtils.lineSectionHeader)) {
                    const headerKeys = DevicesUtils.parseHeaderKeys(line);
                    if (headerKeys[0] === 'deviceId') {
                        tagHeaderKeys = headerKeys;
                    } else {
                        deviceHeaderKeys = headerKeys;
                    }
                    return;
                }
                if (line.startsWith(DevicesUtils.lineDevice)) {
                    // Device
                    let device = deviceHeaderKeys
                        ? DevicesUtils.line2DeviceDynamic(line, deviceHeaderKeys)
                        : DevicesUtils.line2Device(line, deviceKeyLength);
                    devices[device.id] = device;
                } else if (line.startsWith(DevicesUtils.lineTag)) {
                    // Tag
                    let result = tagHeaderKeys
                        ? DevicesUtils.line2TagDynamic(line, tagHeaderKeys, scriptIdByName)
                        : DevicesUtils.line2Tag(line, tagKeyLength);
                    if (!devices[result.deviceId]) {
                        throw new Error(`Device don't exist: ${line}`);
                    }
                    if (devices[result.deviceId].tags[result.tag.id]) {
                        throw new Error(`Tag already exist: ${line}`);
                    }
                    devices[result.deviceId].tags[result.tag.id] = result.tag;
                }
            });
            return Object.values(devices);
        } catch (err) {
            console.error(err);
        }
        return null;
    }

    static device2Line(device: Device, dkeys: string[], pkeys: string[]): string {
        let result = `${DevicesUtils.lineDevice}${DevicesUtils.columnDelimiter}`;
        dkeys.forEach(dk => {
            let text = DevicesUtils.formatCsvValue(device[dk]);
            result += `${text}${DevicesUtils.columnDelimiter}`;
        });
        pkeys.forEach(pk => {
            const text = device.property ? DevicesUtils.formatCsvValue(device.property[pk]) : '';
            result += `${text}${DevicesUtils.columnDelimiter}`;
        });
        return result;
    }

    static line2Device(line: string, deviceKeyLength: number): Device {
        const items = line.split(DevicesUtils.columnDelimiter);
        if (items.length < deviceKeyLength - 1) {
            throw new Error(`Format Error ${items.length}/${deviceKeyLength} ${line}`);
        }
        let device = new Device(items[1]);
        device.name = items[2].replace(new RegExp(DevicesUtils.columnMaske, 'g'), DevicesUtils.columnDelimiter);
        device.enabled = items[3].toLowerCase() === 'true' ? true : false;
        device.type = <DeviceType>items[4];
        device.polling = parseInt(items[5]) || 1000;
        device.property = <DeviceNetProperty>{
            address: items[6],
            port: items[7],
            slot: items[8],
            rack: items[9],
            slaveid: items[10],
            baudrate: items[11],
            databits: items[12],
            stopbits: items[13],
            parity: items[14],
            options: items[15],
            method: items[16],
            format: items[17]
        };
        device.tags = {};
        return device;
    }

    static line2DeviceDynamic(line: string, headerKeys: string[]): Device {
        const data = DevicesUtils.mapLineToData(line, headerKeys);
        const deviceId = data.id;
        if (!deviceId) {
            throw new Error(`Device id missing: ${line}`);
        }
        let device = new Device(deviceId);
        let hasProperty = false;
        Object.keys(data).forEach(key => {
            if (key === 'id') {
                return;
            }
            if (key.startsWith('property.')) {
                if (!device.property) {
                    device.property = <DeviceNetProperty>{};
                }
                hasProperty = true;
                const propKey = key.substring('property.'.length);
                DevicesUtils.setNestedValue(device.property, propKey, data[key]);
                return;
            }
            if (key === 'enabled') {
                device.enabled = Utils.Boolify(data[key]) ? true : false;
                return;
            }
            if (key === 'polling') {
                const polling = parseInt(data[key], 10);
                device.polling = Number.isNaN(polling) ? 1000 : polling;
                return;
            }
            if (key === 'type') {
                device.type = <DeviceType>data[key];
                return;
            }
            device[key] = data[key];
        });
        if (!hasProperty && !device.property) {
            device.property = <DeviceNetProperty>{};
        }
        if (device.polling === undefined || device.polling === null || !device.polling) {
            device.polling = 1000;
        }
        device.tags = {};
        return device;
    }

    static tag2Line(
        tag: Tag,
        deviceId: string,
        tkeys: string[],
        daqKeys: string[],
        scriptNameById?: { [key: string]: string }
    ): string {
        let result = `${DevicesUtils.lineTag}${DevicesUtils.columnDelimiter}${deviceId}${DevicesUtils.columnDelimiter}`;
        tkeys.forEach(tk => {
            let value = tag[tk];
            if (tk === 'scaleReadFunction' || tk === 'scaleWriteFunction') {
                value = DevicesUtils.resolveScriptName(value, scriptNameById);
            }
            let text = DevicesUtils.formatCsvValue(value);
            result += `${text}${DevicesUtils.columnDelimiter}`;
        });
        let options = DevicesUtils.formatCsvValue(tag.options);
        result += `${options}${DevicesUtils.columnDelimiter}`;
        daqKeys.forEach(dk => {
            const value = tag.daq ? tag.daq[dk] : '';
            result += `${DevicesUtils.formatCsvValue(value)}${DevicesUtils.columnDelimiter}`;
        });
        return result;
    }

    static line2Tag(line: string, tagKeyLength: number): { tag: Tag; deviceId: string } {
        const items = line.split(DevicesUtils.columnDelimiter);
        if (items.length < tagKeyLength - 1) {
            throw new Error(`Format Error: ${items.length}/${tagKeyLength} ${line}`);
        }
        const deviceId = items[1];
        let tag = new Tag(items[2]);
        tag.name = items[3].replace(new RegExp(DevicesUtils.columnMaske, 'g'), DevicesUtils.columnDelimiter);
        tag.label = items[4].replace(new RegExp(DevicesUtils.columnMaske, 'g'), DevicesUtils.columnDelimiter);
        tag.type = items[5];
        tag.memaddress = items[6].replace(new RegExp(DevicesUtils.columnMaske, 'g'), DevicesUtils.columnDelimiter);
        tag.address = items[7].replace(new RegExp(DevicesUtils.columnMaske, 'g'), DevicesUtils.columnDelimiter);
        tag.divisor = parseInt(items[8]) || 1;
        tag.init = items[9];
        tag.format = items[10] ? parseInt(items[10]) : null;
        tag.options = items[11].replace(new RegExp(DevicesUtils.columnMaske, 'g'), DevicesUtils.columnDelimiter);
        if (tag.options && Utils.isJson(tag.options)) {
            tag.options = JSON.parse(tag.options);
        }
        tag.daq = <TagDaq>{
            enabled: Utils.Boolify(items[12]) ? true : false,
            changed: true,
            interval: parseInt(items[13]) || 60
        };
        return { tag, deviceId };
    }

    static line2TagDynamic(
        line: string,
        headerKeys: string[],
        scriptIdByName?: { [key: string]: string }
    ): { tag: Tag; deviceId: string } {
        const data = DevicesUtils.mapLineToData(line, headerKeys);
        const deviceId = data.deviceId;
        const tagId = data.id;
        if (!deviceId || !tagId) {
            throw new Error(`Tag missing deviceId or id: ${line}`);
        }
        let tag = new Tag(tagId);
        tag.daq = tag.daq || new TagDaq(false, false, 60, false);
        Object.keys(data).forEach(key => {
            if (key === 'deviceId' || key === 'id') {
                return;
            }
            if (key === 'divisor') {
                const divisor = parseInt(data[key], 10);
                tag.divisor = Number.isNaN(divisor) ? 1 : divisor;
                return;
            }
            if (key === 'format') {
                const format = parseInt(data[key], 10);
                tag.format = Number.isNaN(format) ? null : format;
                return;
            }
            if (key === 'sysType') {
                const sysType = parseInt(data[key], 10);
                tag.sysType = Number.isNaN(sysType) ? data[key] : sysType;
                return;
            }
            if (key === 'options') {
                tag.options = data[key];
                return;
            }
            if (key.startsWith('daq.')) {
                const daqKey = key.substring('daq.'.length);
                if (!tag.daq) {
                    tag.daq = <TagDaq>{};
                }
                if (daqKey === 'interval') {
                    const interval = parseInt(data[key], 10);
                    tag.daq.interval = Number.isNaN(interval) ? 60 : interval;
                } else if (daqKey === 'enabled' || daqKey === 'changed' || daqKey === 'restored') {
                    tag.daq[daqKey] = Utils.Boolify(data[key]) ? true : false;
                } else {
                    tag.daq[daqKey] = data[key];
                }
                return;
            }
            if (key === 'scaleReadFunction' || key === 'scaleWriteFunction') {
                tag[key] = DevicesUtils.resolveScriptId(data[key], scriptIdByName);
                return;
            }
            tag[key] = data[key];
        });
        if (tag.daq && tag.daq.changed === undefined) {
            tag.daq.changed = true;
        }
        return { tag, deviceId };
    }
    //#endregion

    //#region Placeholder
    static placeholderToTag(variableId: string, tags: Tag[]): Tag {
        const placeholder = DevicesUtils.getPlaceholderContent(variableId);
        if (placeholder.firstContent) {
            return tags?.find(t => t.name === placeholder.firstContent);
        }
        return null;
    }

    static getPlaceholderContent(text: string): Placeholder {
        const firstAt = text.indexOf('@');
        if (firstAt === -1) {
            return { firstContent: null, secondContent: null };
        }
        const secondAt = text.indexOf('@', firstAt + 1);
        if (secondAt === -1) {
            const firstContent = text.substring(firstAt + 1).trim();
            return { firstContent, secondContent: null };
        }
        const firstContent = text.substring(firstAt + 1, secondAt).trim();
        const secondContent = text.substring(secondAt + 1).trim();
        return { firstContent, secondContent };
    }
    //# endregion
}

export interface Placeholder {
    firstContent: string;
    secondContent?: string;
}

export enum DeviceViewModeType {
    tags = 'tags',
    devices = 'devices',
    list = 'devices-list',
    map = 'devices-map',
}

export enum DeviceConnectionStatusType {
    ok = 'device.connect-ok',
    error = 'device.connect-error',
    failed = 'device.connect-failed',
    off = 'device.connect-off',
    busy = 'device.connect-busy',
}

export enum ServerTagType {
    number = 'number',
    boolean = 'boolean',
    string = 'string'
}


export class TagScale {
    mode: TagScaleModeType;
    rawLow: number;
    rawHigh: number;
    scaledLow: number;
    scaledHigh: number;
    dateTimeFormat: string;
    readExpression: string;
    writeExpression: string;
}

export enum TagScaleModeType {
    undefined = 'device.tag-scale-mode-undefined',
    linear = 'device.tag-scale-mode-linear',
    convertDateTime = 'device.tag-convert-datetime',
    convertTickTime = 'device.tag-convert-ticktime',
    expression = 'device.tag-scale-mode-expression',
}

export enum TagSystemType {
    deviceConnectionStatus = 1,
}
