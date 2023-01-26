export class AppSettings {
    /** Editor language */
    language = 'en';
    /** Web server port */
    uiPort = 1881;
    /** Security access to enable user and authentication */
    secureEnabled = false;
    /** Expiration of authanticated token (15m)*/
    tokenExpiresIn = '1h';
    /** Smtp to send mails */
    smtp = new SmtpSettings();
    /** Daq store database */
    daqstore = new DaqStore();
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
    retention = DaqStoreRetentionType.year1;

    constructor(daqstore: DaqStore = null) {
        if (daqstore) {
            this.type = daqstore.type;
            this.url = daqstore.url;
            this.organization = daqstore.organization;
            this.credentials = daqstore.credentials;
            this.bucket = daqstore.bucket;
            this.retention = daqstore.retention || DaqStoreRetentionType.year1;
        }
    }

    isEquals(store: DaqStore) {
        if (this.type === store.type && this.bucket === store.bucket && this.url === store.url && this.organization === store.organization &&
            (this.credentials && StoreCredentials.isEquals(this.credentials, store.credentials)) && this.retention === store.retention) {
            return true;
        }
        return false;
    }
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
}

export class MailMessage {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
}
