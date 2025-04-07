Server settings are located in 'server\\_appdata\settings.js' file. You have to restart the server after your change.

### Authentication
To enable and config the authentication:

```
secureEnabled: true,            // enable or diasable
secretCode: 'frangoteam751',    // secret code to encode the token
tokenExpiresIn: '1h'            // token expiration delay '1h'=1hour, 60=60seconds, '1d'=1day
```

The default user ‘admin’ have the ‘123456’ as password, of course you can change it.