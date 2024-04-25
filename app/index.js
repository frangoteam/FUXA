const {app, utilityProcess, BrowserWindow} = require('electron')
const path = require('node:path')

const fs = require('fs')
const {fork} = require('child_process');

let serverEntry = path.join(__dirname, 'server/main.js')
if (!fs.existsSync(serverEntry)) {
    serverEntry = path.join(__dirname, '../server/main.js')
}
const appData = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + "/.local/share")
const userDataDir = path.join(appData, 'fuxa-app', 'data')

if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir)
    // fs.copyFileSync(path.join(__dirname, 'settings.default.js'),path.join(userDataDir,'settings.default.js'))
}
//setting for fuxa server
process.env.userDir = userDataDir

require(serverEntry)

const createWindow = () => {
    const win = new BrowserWindow({
        width: 1024,
        height: 768,
        webPreferences: {
            // preload: path.join(__dirname, 'preload.js')
        }
    })
    //wait for server startup
    setTimeout(() => {
        win.loadURL('http://localhost:1881')
    }, 1000)

    // const worker = new BrowserWindow({
    //     show:true,
    //     width: 1024,
    //     height: 768,
    //     webPreferences: {
    //         nodeIntegration: true
    //     }
    // })
    // worker.loadFile(path.join(__dirname,'server.html'))
}

app.whenReady().then(() => {
    createWindow()
})
