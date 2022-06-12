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
    credential?: StoreCredential;
    bucket?: string;
    constructor(daqstore: DaqStore = null) {
        if (daqstore) {
            this.type = daqstore.type;
            this.url = daqstore.url;
            this.organization = daqstore.organization;
            this.credential = daqstore.credential;
            this.bucket = daqstore.bucket;
        }
    }

    isEquals(store: DaqStore) {
        if (this.type === store.type && this.bucket === store.bucket && this.url === store.url && this.organization === store.organization &&
            (this.credential && this.credential.isEquals(store.credential))) {
            return true;
        }
        return false;
    }
}

export class StoreCredential {
    token?: string;
    username?: string;
    password?: string;

    isEquals(credential: StoreCredential) {
        return (this.token === credential.token && this.username === credential.username && this.password === credential.password);
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

export class MailMessage {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
}