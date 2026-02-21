![fuxa logo](/client/src/favicon.ico)
# FUXA
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-online-brightgreen)](https://frangoteam.github.io/FUXA/)
[![Node](https://img.shields.io/badge/node-18%20LTS-green)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/docker-supported-blue)](https://hub.docker.com/r/frangoteam/fuxa)

FUXA is a web-based Process Visualization (SCADA/HMI/Dashboard) software. With FUXA you can create modern process visualizations with individual designs for your machines and real-time data display.

![fuxa editor](/screenshot/fuxa-editor.png)

![fuxa ani](/screenshot/fuxa-thinglinks.gif)

![fuxa action](/screenshot/feature-action-move.gif)

## ✨ Features
- Devices connectivity with Modbus RTU/TCP, Siemens S7 Protocol, OPC-UA, BACnet IP, MQTT, Ethernet/IP (Allen Bradley), ODBC, ADSclient, Gpio (Raspberry), WebCam, MELSEC, Redis
- SCADA/HMI Web-Editor - Engineering and Design completely web-based
- Cross-Platform Full-Stack - Backend with NodeJs and Frontend with Web technologies (HTML5, CSS, Javascript, Angular, SVG)

## 🚀 Live Demo
Here is a [live demo](https://frangoteam.github.io) example of FUXA editor.

## 📚 Documentation

Official documentation is available at:

👉 https://frangoteam.github.io/FUXA/

The documentation source is located in the `/docs` directory of this repository.

The site is built using MkDocs (Material theme) and automatically deployed via GitHub Actions.

## 🛠 Installing and Running
FUXA is developed with NodeJS (backend) and Angular (frontend).

For detailed guides and advanced configuration options, see the official documentation:

👉 https://frangoteam.github.io/FUXA/


### 1° Option - Running from docker
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

Open up a browser (better Chrome) and navigate to http://localhost:1881

### 2° Option - Install from source
[Download the latest release](https://github.com/frangoteam/FUXA/releases) and unpack it

You need to have installed [Node.js](https://nodejs.org/en/about/previous-releases)
- Recommended: Node.js 18 LTS

**Note** Starting from FUXA 1.2.7, Node.js 14 and older versions are not supported due to upstream dependency updates.

**WARNING** On Linux systems (especially Raspberry Pi), installing native dependencies with Node.js 18 may require additional build tools.
If you do not intend to use specific features, you can safely remove them from ```server/package.json```:
- Remove ```node-snap7``` if you do not need Siemens S7 communication
- Remove ```odbc``` if you do not need external database connectivity

```
cd ./server
npm install
npm start
```

Open up a browser (better Chrome) and navigate to http://localhost:1881

### 3° Option - Install from [NPM](https://www.npmjs.com/package/@frangoteam/fuxa)

You need to have installed [Node.js](https://nodejs.org/en/about/previous-releases)
- Recommended: Node.js 18 LTS

**WARNING** In linux with nodejs Version 18 the installation could be a challenge.
If you don't intend communicate with Siemens PLCs via S7 (node-snap7 library) you can install from [NPM @frangoteam/fuxa-min](https://www.npmjs.com/package/@frangoteam/fuxa-min)

```
npm install -g --unsafe-perm @frangoteam/fuxa
fuxa
```

Open up a browser (better Chrome) and navigate to http://localhost:1881

### 4° Option - Install using prebuilt Electron Packages

You will need to be logged into github to access the download button for Electron Action Builds,
click on the workflow and scroll down to Artifacts and click the download icon for you system

[Electron Action Builds](https://github.com/frangoteam/FUXA/actions/workflows/electron_latest.yml)

<img width="2082" height="531" alt="image" src="https://github.com/user-attachments/assets/40f01e1d-cf39-4145-99a0-e8fedf791edf" />

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

## Usage and Documentation
- 📚 Official Documentation: https://frangoteam.github.io/FUXA/
- Look video from [frangoteam](https://www.youtube.com/@umbertonocelli5301)
- Look video from [Fusion Automate - Urvish Nakum](https://youtube.com/playlist?list=PLxrSjjYyzaaK8uY3kVaFzfGnwhVXiCEAO&si=aU1OxgkUvLQ3bXHq)
- Browse the [DeepWiki](https://deepwiki.com/frangoteam/FUXA) for AI-assisted docs and code navigation
## Community SVG Widgets

Looking for ready-made, reusable SVG widgets?
Check out the companion repository **FUXA-SVG-Widgets**:

- Repository: https://github.com/frangoteam/FUXA-SVG-Widgets
- Authoring guide & examples: see the repo README and the Wiki page:
  https://github.com/frangoteam/FUXA/wiki/HowTo-Widgets

## 🧪 To Debug (Full Stack)
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

## 🏗 To Build
Build the frontend for production
```
cd ./client
ng build --configuration=production
```

## 🤝 Contributing

Contributions are welcome and greatly appreciated.

You can contribute by:

- Improving or fixing code
- Enhancing documentation
- Reporting bugs
- Proposing new features
- Sharing examples and use cases

Before submitting a Pull Request, please open an issue to discuss major changes.

For full contribution guidelines (code and documentation), please read:

👉 [CONTRIBUTING.md](CONTRIBUTING.md)

## 💬 Let us know!
We’d be really happy if you send us your own shapes in order to collect a library to share it with others. Just send an email to info@frangoteam.org and do let us know if you have any questions or suggestions regarding our work.

## <a href="https://discord.gg/WZhxz9uHh4" target="_blank" > <img src="https://skillicons.dev/icons?i=discord" alt=""></a>

## 📄 License
MIT.
