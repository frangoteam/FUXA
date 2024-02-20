export class AppSettings {
    /** Editor language */
    language = 'en';
    /** Web server port */
    uiPort = 1881;
    /** Security access to enable user and authentication */
    secureEnabled = false;
    /** Expiration of authanticated token (15m)*/
    tokenExpiresIn = '1h';
    /** authentication are valid only for edit mode */
    secureOnlyEditor = false;
    /** Broadcast all tags, without check the frontend views */
    broadcastAll = true;
    /** Smtp to send mails */
    smtp = new SmtpSettings();
    /** Daq store database */
    daqstore = new DaqStore();
    /** Alarms store settings */
    alarms = new AlarmsSettings();
    /** Log Full enabled to log all setValue */
    logFull = false;
}

export class SmtpSettings {
    /** Host address */
    host = '';
    /** Connection port */
    port = 587;
    /** Sender Email address */
    mailsender = '';
    /** authentication user */
    username = '';
    /** authentication password */
    password = '';

    constructor(smtp: SmtpSettings = null) {
        if (smtp) {
            this.host = smtp.host;
            this.port = smtp.port;
            this.mailsender = smtp.mailsender;
            this.username = smtp.username;
            this.password = smtp.password;
        }
    }
}

export class DaqStore {
    type = DaqStoreType.SQlite;
    varsion?: string;
    url?: string;
    organization?: string;
    credentials?: StoreCredentials;
    bucket?: string;
    database?: string;
    retention = DaqStoreRetentionType.year1;

    constructor(daqstore: DaqStore = null) {
        if (daqstore) {
            this.type = daqstore.type;
            this.url = daqstore.url;
            this.organization = daqstore.organization;
            this.credentials = daqstore.credentials;
            this.bucket = daqstore.bucket;
            this.database = daqstore.database;
            this.retention = daqstore.retention || DaqStoreRetentionType.year1;
        }
    }

    isEquals(store: DaqStore) {
        if (this.type === store.type && this.bucket === store.bucket && this.url === store.url &&
            this.organization === store.organization && this.database === store.database &&
            (this.credentials && StoreCredentials.isEquals(this.credentials, store.credentials)) && this.retention === store.retention) {
            return true;
        }
        return false;
    }
}

export class AlarmsSettings {
    retention = AlarmsRetentionType.year1;
}

export class StoreCredentials {
    token?: string;
    username?: string;
    password?: string;

    static isEquals(a: StoreCredentials, b: StoreCredentials) {
        return (a.token === b.token && a.username === b.username && a.password === b.password);
    }
}

export enum DaqStoreType {
    SQlite = 'SQlite',
    influxDB = 'influxDB',
    influxDB18 = 'influxDB 1.8',
    TDengine = 'TDengine' ,
}

export enum influxDBVersionType {
    VERSION_18_FLUX = '1.8-flux',
    VERSION_20 = '2.0',
}

export enum DaqStoreRetentionType {
    none = 'none',
    day1 = 'day1',
    days2 = 'days2',
    days3 = 'days3',
    days7 = 'days7',
    days14 = 'days14',
    days30 = 'days30',
    days90 = 'days90',
    year1 = 'year1',
    year3 = 'year3',
    year5 = 'year5',
}

export enum AlarmsRetentionType {
    none = 'none',
    days7 = 'days7',
    days30 = 'days30',
    days90 = 'days90',
    year1 = 'year1',
    year3 = 'year3',
    year5 = 'year5',
}

export class MailMessage {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
}
