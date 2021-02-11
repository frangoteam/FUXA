
module.exports = {
    // Version to manage update
    version: 1.1,
    
    // Standard language (editor)
    language: 'en',

    // The tcp port that the FUXA web server is listening on
    uiPort: process.env.PORT || 1881,

    // Used to identify a directory of logger
    // Default: '_logs'
    logDir: '_logs',

    // Used to storage Database like DAQ, User
    // Default: '_db'    
    dbDir: '_db',

    // DAQ Enabled
    // Default: true    
    daqEnabled: true,

    // DAQ DB to Tokenizer the file and save in archive
    // Default: 24 Hours (1 Day), 0 is disabled only 1 DB file
    daqTokenizer: 24,

    // By default, server accepts connections on all IPv4 interfaces.
    // To listen on all IPv6 addresses, set uiHost to "::",
    // The following property can be used to listen on a specific interface. For
    // example, the following would only allow connections from the local machine.
    //uiHost: "127.0.0.1",

    // Used to identify a directory of static content
    // that should be served at http://localhost:1881/.
    // Default: '/client/dist'
    //httpStatic: '/usr/home/fuxa/dist',

    // The maximum size of HTTP request that will be accepted by the runtime api.
    // Default: 15mb
    //apiMaxLength: '15mb',

    // Used to disable the server API used for Backend communication (Standalone application)
    // disable to use only the Editor
    //disableServer: false,

    // The following property can be used to enable HTTPS !NOT SUPPORTED NOW!
    // See http://nodejs.org/api/https.html#https_https_createserver_options_requestlistener
    // for details on its contents.
    // See the comment at the top of this file on how to load the `fs` module used by
    // this setting.
    //
    //https: {
    //    key: fs.readFileSync('privatekey.pem'),
    //    cert: fs.readFileSync('certificate.pem')
    //},

    // Used to enable security, authentication and authorization and crypt Token
    //secureEnabled: true,
    //secretCode: 'frangoteam751',
    //tokenExpiresIn: '1h'  // '1h'=1hour, 60=60seconds, '1d'=1day

    // Enable GPIO in Raspberry
    // To enable only by Raspberry Host
    
}