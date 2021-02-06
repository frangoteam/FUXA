![fuxa logo](/client/src/favicon.ico) 
# FUXA
FUXA is a web-based Process Visualization (SCADA/HMI) software. With FUXA you can create modern process visualizations with individual designs for your machines and real-time data display.

![fuxa editor](/screenshot/fuxa-editor.png) 

![fuxa ani](/screenshot/fuxa-ani.gif)

## Features
- Devices connectivity with Modbus RTU/TCP, Siemens S7 Protocol, OPC-UA, BACnet IP
- SCADA/HMI Web-Editor - Engineering and Design completely web-based
- Cross-Platform Full-Stack - Backend with NodeJs and Frontend with Web technologies (HTML5, CSS, Javascript, Angular, SVG)

## Live Demo
Here is a [live demo](https://frangoteam.github.io) example of FUXA editor.

## Installing and Running
FUXA is developed with NodeJS (backend) and Angular (frontend).

You need to have installed [Node](https://nodejs.org) (Version 10, 12 or 14) and NPM (Version >=6.11).

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
Open up a browser (better Chrome) and navigate to http://localhost:1881

## Usage
Look the guide in [wiki](https://github.com/frangoteam/FUXA/wiki) pages

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
ng build --prod
```

## Test
Tested with:
- Ubuntu 16.04 LTS, nodejs version 10.22.0, npm version 6.14.6
- Windows 10, nodejs version 10.8.0, npm version 6.2.0
- Raspberry PI (Raspbian 2018-11-13, Kernel 4.14), nodejs version 10.15.3, npm version 6.4.1

## Contributing
Any contributions you make are greatly appreciated.
If you identify any errors, or have an idea for an improvement, please open an [issue](/../../issues).
But before filing a new issue, please look through already existing issues. Search open and closed issues first.

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

## Let us know!
We’d be really happy if you send us your own shapes in order to collect a library to share it with others. Just send an email to 4frango@gmail.com and do let us know if you have any questions or suggestions regarding our work.

## Thank you!
- [SVG-edit](https://github.com/SVG-Edit/svgedit)
- [node-snap7](https://github.com/mathiask88/node-snap7)
- [node-opcua](https://github.com/node-opcua/node-opcua)
- [node-modbus-serial](https://github.com/yaacov/node-modbus-serial)
- [node-bacstack](https://github.com/fh1ch/node-bacstack)

## License
MIT.