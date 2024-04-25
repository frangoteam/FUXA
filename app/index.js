const {app, utilityProcess, BrowserWindow} = require('electron')
const path = require('node:path')
const fs = require('fs')

let serverEntry = path.join(__dirname, 'server/main.js')
if (!fs.existsSync(serverEntry)) {
    serverEntry = path.join(__dirname, '../server/main.js')
}
const appData = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + "/.local/share")
const userDataDir = path.join(appData, 'fuxa-app', 'data')

if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, {recursive: true})
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
}

app.whenReady().then(() => {
    createWindow()
})
