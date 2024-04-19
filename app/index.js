const {app, BrowserWindow} = require('electron')
const path = require('node:path')

const fs = require('node:fs')
let serverEntry = path.join(__dirname, 'server/main.js')
if (!fs.existsSync(serverEntry)) {
    serverEntry = path.join(__dirname, '../server/main.js')
}
require(serverEntry)

const createWindow = () => {
    const win = new BrowserWindow({
        width: 1024,
        height: 768,
    })
    //wait for server startup
    setTimeout(()=>{
        win.loadURL('http://localhost:1881')
    },1000)
}

app.whenReady().then(() => {
    createWindow()
})
