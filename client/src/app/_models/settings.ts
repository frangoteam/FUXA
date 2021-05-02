export class AppSettings {
    /** Editor language */
    language = 'en';
    /** Web server port */
    uiPort = 1881;
    /** Security access to enable user and authentication */
    secureEnabled = false;
    /** Expiration of authanticated token (15m)*/
    tokenExpiresIn = '1h';
}