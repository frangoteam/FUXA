![fuxa logo](/client/src/favicon.ico) 
# FUXA
FUXA is a web-based Process Visualization (SCADA/HMI) software. With FUXA you can create modern process visualizations with individual designs for your machines and real-time data display.

![fuxa editor](/screenshot/fuxa-editor.png) 

## Live Demo
Here is a [live demo](http://frango.internet-box.ch:1881/) example of FUXA editor.

## Installing and Running
FUXA is develop with NodeJS (backend) and Angular (frontend). You need to have installed [Node](https://nodejs.org) and NPM.

Clone this repository or download it
```
git clone https://github.com/frangoteam/fuxa.git
```
Install
```
cd ./server
npm install
```
Start NodeJS server at http://localhost:1881
```
cd ./server
npm start
```
Open up a browser (better Chrome) and navigate to http://localhost:1881

## Usage
First define your Device and bind the Variable or Signals
![fuxa device](/screenshot/fuxa-device.gif)

Than design your HMI pages with the SVG editor
![fuxa hmi](/screenshot/fuxa-hmi.gif)

Now you can test by change the values to PLC or manually with the testbench
![fuxa test](/screenshot/fuxa-test.gif)

## Test
Teste with:
- Windows 10, nodejs version 10.8.0, npm version 6.2.0
- Raspberry PI (Raspbian 2018-11-13, Kernel 4.14), nodejs version 10.15.3, npm version 6.4.1

## License
MIT.
