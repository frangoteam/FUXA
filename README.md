![fuxa logo](/client/src/favicon.ico)
# FUXA
FUXA is a web-based Process Visualization (SCADA/HMI/Dashboard) software. With FUXA you can create modern process visualizations with individual designs for your machines and real-time data display.

![fuxa editor](/screenshot/fuxa-editor.png)

![fuxa ani](/screenshot/fuxa-ani.gif)

![fuxa action](/screenshot/feature-action-move.gif)

## Features
- Devices connectivity with Modbus RTU/TCP, Siemens S7 Protocol, OPC-UA, BACnet IP, MQTT, Ethernet/IP (Allen Bradley)
- SCADA/HMI Web-Editor - Engineering and Design completely web-based
- Cross-Platform Full-Stack - Backend with NodeJs and Frontend with Web technologies (HTML5, CSS, Javascript, Angular, SVG)

## Live Demo
Here is a [live demo](https://frangoteam.github.io) example of FUXA editor.

## Installing and Running
FUXA is developed with NodeJS (backend) and Angular (frontend).

See the Wiki for more details about installing and getting started

[Wiki](https://github.com/frangoteam/FUXA/wiki)

[Wiki Installing/Building](https://github.com/frangoteam/FUXA/wiki/Installing-and-Running)


### Running from docker
```
docker pull frangoteam/fuxa:latest
docker run -d -p 1881:1881 frangoteam/fuxa:latest

// persistent storage of application data (project), daq (tags history), logs and images (resource)
docker run -d -p 1881:1881 -v fuxa_appdata:/usr/src/app/FUXA/server/_appdata -v fuxa_db:/usr/src/app/FUXA/server/_db -v fuxa_logs:/usr/src/app/FUXA/server/_logs -v fuxa_images:/usr/src/app/FUXA/server/_images frangoteam/fuxa:latest

// with Docker compose
// persistent storage will be at ./appdata ./db ./logs and ./images
wget https://raw.githubusercontent.com/frangoteam/FUXA/master/compose.yml
docker compose up -d
```

### Install from [NPM](https://www.npmjs.com/package/@frangoteam/fuxa)

You need to have installed [Node](https://nodejs.org/en/about/previous-releases) Version 18.

**WARNING** In linux with nodejs Version 18 the installation could be a challenge.
If you don't intend communicate with Siemens PLCs via S7 (node-snap7 library) you can install from [NPM @frangoteam/fuxa-min](https://www.npmjs.com/package/@frangoteam/fuxa-min)

```
npm install -g --unsafe-perm @frangoteam/fuxa
fuxa
```

### Install from source
[Download the latest release](https://github.com/frangoteam/FUXA/releases) and unpack it

You need to have installed [Node](https://nodejs.org/en/about/previous-releases) Version 18.

**WARNING** In linux with nodejs Version 18 the installation could be a challenge.
If you don't intend communicate with Siemens PLCs via S7 you can remove the node-snap7 library from the server/package.json

```
cd ./server
npm install
npm start
```

Open up a browser (better Chrome) and navigate to http://localhost:1881

**Note** If you intend to use nodejs version 14, please remove odbc from the package.json dependencies. nodejs 14 may have compatibility issues with certain versions of odbc, which could lead to installation errors.

### Creating the Electron Application
Electron is a framework for building cross-platform desktop applications using web technologies. An Electron application is standalone, meaning it can be run independently on your desktop without needing a web browser.

To create the Electron application, you need to have node.js 18 installed. Follow these steps:

Build Server and Client First
```
cd ./server
npm install
cd ../client
npm install
npm run build
```

Packaging
```
cd ./app
npm install
npm run package
```

After following these steps, you will have a standalone Electron application for FUXA. The application can be found in the ./app directory.

## Usage
- Look the guide in [wiki](https://github.com/frangoteam/FUXA/wiki) pages
- Look video from [frangoteam](https://www.youtube.com/@umbertonocelli5301)
- Look video from [Fusion Automate - Urvish Nakum](https://youtube.com/playlist?list=PLxrSjjYyzaaK8uY3kVaFzfGnwhVXiCEAO&si=aU1OxgkUvLQ3bXHq)

## To Debug (Full Stack)
Install and start to serve the frontend
```
cd ./client
npm install
npm start
```

Start the Server and Client (Browser) in Debug Mode
```
In vscode: Debug ‘Server & Client’
```

## To Build
Build the frontend for production
```
cd ./client
ng build --configuration=production
```

## Contributing
Any contributions you make are greatly appreciated.
If you identify any errors, or have an idea for an improvement, please open an [issue](/../../issues).
But before filing a new issue, please look through already existing issues. Search open and closed issues first.

Non-code contributions are also highly appreciated, such as improving the documentation or promoting FUXA on social media.

### Pull-Requests
If you want to raise a pull-request with a new feature, or a refactoring of existing code please first open an issue explaining the problem.
```
1. Fork the Project
2. Create your Feature Branch (git checkout -b feature/AmazingFeature)
3. Commit your Changes (git commit -m 'Add some AmazingFeature')
4. Push to the Branch (git push origin feature/AmazingFeature)
5. Open a Pull Request
```

### Coding standards
Please ensure you follow the coding standards used through-out the existing code base. Some basic rules include:
- Indent with 4-spaces, no tabs.
- Opening brace on same line as if/for/function and so on, closing brace on its own line.

## Some collaborations
<div >
    <a href="https://wiki.seeedstudio.com/reTerminal-DM_intro_FUXA/" target="_blank" style="margin-right: 100px; line-height: 60px">
        <img src="https://frangoteam.org/assets/images/seeed-studio2.png" alt="" style="vertical-align: top"></a>
</div>

## Let us know!
We’d be really happy if you send us your own shapes in order to collect a library to share it with others. Just send an email to info@frangoteam.org and do let us know if you have any questions or suggestions regarding our work.

## <a href="https://discord.gg/WZhxz9uHh4" target="_blank" > <img src="https://skillicons.dev/icons?i=discord" alt=""></a>

## License
MIT.
