FUXA is developed with NodeJS (backend) and Angular (frontend).

You need to have installed [Node](https://nodejs.org) (Version 10, 12 or 14) and NPM (Version >=6.11 and < 7), as best you can install 'Latest LTS Version: 14.17.4 (includes npm 6.14.14)'. If you don't need to change or debug the frontend, you can use the NoodeJS Version 16 too. It is possible that you need Python 2.7 or 3.9 (in Windows add to Environment Variable PATH) why some packages must be compiled from the source.

Install from [NPM](https://www.npmjs.com/package/@frangoteam/fuxa) (first option)
```
npm install -g --unsafe-perm @frangoteam/fuxa
fuxa
```

Or [Download the latest release](https://github.com/frangoteam/FUXA/releases) and unpack it (second option)
```
cd ./server
npm install
npm start
```

Or in linux running from docker (third option)
```
docker pull frangoteam/fuxa:latest
docker run -d -p 1881:1881 frangoteam/fuxa:latest
```
Persistent storage of application data (project), daq (tags history), logs and resources images
```
docker run -d -p 1881:1881 -v fuxa_appdata:/usr/src/app/FUXA/server/_appdata -v fuxa_db:/usr/src/app/FUXA/server/_db -v fuxa_logs:/usr/src/app/FUXA/server/_logs -v fuxa_shapes:/usr/src/app/FUXA/client/assets/lib/svgeditor/shapes -v fuxa_images:/usr/src/app/FUXA/server/_images frangoteam/fuxa:latest
```

Open up a browser (better Chrome) and navigate to http://localhost:1881