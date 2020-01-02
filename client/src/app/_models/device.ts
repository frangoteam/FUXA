
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
    value: string;
    type: string;
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
}

export class DeviceSecurity {
    mode: any;
    username: string;
    password: string;
}

export enum DeviceType {
    FuxaServer = 'FuxaServer',
    SiemensS7 = 'SiemensS7',
    OPCUA = 'OPCUA'
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