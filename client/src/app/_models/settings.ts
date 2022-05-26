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
    url?: string;
    organization?: string;
    token?: string;
    bucket?: string;
    constructor(daqstore: DaqStore = null) {
        if (daqstore) {
            this.type = daqstore.type;
            this.url = daqstore.url;
            this.organization = daqstore.organization;
            this.token = daqstore.token;
            this.bucket = daqstore.bucket;
        }
    }
}

export enum DaqStoreType {
    SQlite = 'SQlite',
    influxDB = 'influxDB',
}

export class MailMessage {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
}