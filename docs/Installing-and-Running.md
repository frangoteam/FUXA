FUXA is developed with NodeJS (backend) and Angular (frontend).

**Prebuilt Electron App** (first option)

You will need to be logged into github to access the download button for Electron Action Builds, 
click on the workflow and scroll down to Artifacts and click the download icon for you system

[Electron Action Builds](https://github.com/frangoteam/FUXA/actions/workflows/electron_latest.yml)

<img width="2082" height="531" alt="image" src="https://github.com/user-attachments/assets/cf0e5282-f1ef-48b3-a122-de2a2754cf19" />

**Headless Portable Binaries** (alternative to Electron)

For headless deployments on embedded devices, servers, or systems without a GUI, FUXA provides self-contained portable binaries that bundle the entire application (server, client) into a single executable file.

These binaries are ideal for industrial environments, IoT devices, and automated systems where no user interface is needed.

### Downloading Headless Binaries

Headless binaries are available as GitHub Actions artifacts. You need to be logged into GitHub to download them.

[Headless Portable Builds](https://github.com/frangoteam/FUXA/actions/workflows/headless_packaging.yml)

Click on the latest workflow run, scroll down to "Artifacts", and download the appropriate file for your platform:

- **Linux**: `fuxa-headless-linux-x64` (or `fuxa-headless-linux-arm64` for ARM devices)
- **Windows**: `fuxa-headless-win-x64.exe`
- **macOS**: `fuxa-headless-macos-x64` (or `fuxa-headless-macos-arm64` for Apple Silicon)

### Running Headless Binaries

#### Linux
1. Download the Linux binary (e.g., `fuxa-headless-linux-x64`).
2. Make it executable: `chmod +x fuxa-headless-linux-x64`
3. Run: `./fuxa-headless-linux-x64`
4. Access via web browser at `http://localhost:1881` (or the device's IP:1881)

#### Windows
1. Download the Windows executable (e.g., `fuxa-headless-win-x64.exe`).
2. Double-click the `.exe` file to run.
3. Access via web browser at `http://localhost:1881`

#### macOS
1. Download the macOS binary (e.g., `fuxa-headless-macos-x64`).
2. Make it executable: `chmod +x fuxa-headless-macos-x64`
3. Run: `./fuxa-headless-macos-x64`
4. Access via web browser at `http://localhost:1881`

### Headless Features
- **Self-contained**: No external dependencies or installations required.
- **Data persistence**: User data is stored in `~/.fuxa-headless-data` on the host system.
- **Cross-platform**: Runs on Windows, macOS, and Linux (including ARM architectures).
- **Industrial protocols**: Full support for Modbus, OPC-UA, MQTT, Siemens S7, and more.
- **Web interface**: Access the full FUXA editor and dashboards via any web browser.

### Troubleshooting
- Ensure port 1881 is available and not blocked by firewalls.
- For embedded devices, check system resources (RAM, CPU) as FUXA uses Node.js runtime.
- Logs are available in the user data directory (`~/.fuxa-headless-data/logs`).

**Access with Web browser once installed non Electron Install**

Once you have finished one of the install processes you can access the Fuxa UI via default port 1881 and the web server IP address either localhost or the IP of the Host machine, first try localhost:1881 or host machine IP:1881

**Docker Compose** (second option)

Install Docker
```
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh ./get-docker.sh
```
```
cd
mkdir docker
mkdir fuxa
cd docker/fuxa
sudo nano docker-compose.yml
```

Enter this into compose file:
```
version: '3.5'

services:
    fuxa:
        image: frangoteam/fuxa:latest
        network_mode: "host"
        volumes:
            - ./fuxa_appdata:/usr/src/app/FUXA/server/_appdata
            - ./fuxa_db:/usr/src/app/FUXA/server/_db
            - ./fuxa_logs:/usr/src/app/FUXA/server/_logs
        environment:
            - TZ=America/New_York
        restart: always
```
Note: This Compose file uses host network mode see [Docker Networks](https://docs.docker.com/engine/network/) for more details, host allows the docker container to be on the same networks as the host machine. Works best for direct access to PLCs/Databases etc but there are some limitations, it only works on Linux based systems, if you need to run on Windows you will need to use bridge network mode.

`network_mode: "bridge"`

Start Docker Compose

`sudo docker compose up -d`

**Docker** (third option)
```
docker pull frangoteam/fuxa:latest
docker run -d -p 1881:1881 frangoteam/fuxa:latest
```
Persistent storage of application data (project), daq (tags history), logs and resources images
```
docker run -d -p 1881:1881 -v fuxa_appdata:/usr/src/app/FUXA/server/_appdata -v fuxa_db:/usr/src/app/FUXA/server/_db -v fuxa_logs:/usr/src/app/FUXA/server/_logs -v fuxa_shapes:/usr/src/app/FUXA/client/assets/lib/svgeditor/shapes -v fuxa_images:/usr/src/app/FUXA/server/_images frangoteam/fuxa:latest
```
**Build Custom Docker Image from Source** (fourth option)

This will build from the latest master branch ( you can edit the docker file to change the branch )
```
cd
mkdir docker
mkdir fuxa
cd docker/fuxa
mkdir fuxa-build
cd fuxa-build
```
`wget https://raw.githubusercontent.com/frangoteam/FUXA/master/Dockerfile`

`sudo docker build -t fuxa-custom-image-name --no-cache .`

Once the build is complete, you can now use the custom image for example:

```
version: '3.5'

services:
    fuxa:
        image: fuxa-custom-image-name
        network_mode: "host"
        volumes:
            - ./fuxa_appdata:/usr/src/app/FUXA/server/_appdata
            - ./fuxa_db:/usr/src/app/FUXA/server/_db
            - ./fuxa_logs:/usr/src/app/FUXA/server/_logs
        environment:
            - TZ=America/New_York
        restart: always
```

**Installing with Node and NPM**

You need to have installed [Node](https://nodejs.org/en/about/previous-releases) Version 18.

**WARNING** In linux with nodejs Version 18 the installation could be a challenge. If you don't intend communicate with Siemens PLCs via S7 (node-snap7 library) you can install from [NPM @frangoteam/fuxa-min](https://www.npmjs.com/package/@frangoteam/fuxa-min)

**NPM** (fifth option)

Install from [NPM](https://www.npmjs.com/package/@frangoteam/fuxa)
```
npm install -g --unsafe-perm @frangoteam/fuxa
fuxa
```

**Latest Release** (fifth option)

[Download the latest release](https://github.com/frangoteam/FUXA/releases) and unpack it

**WARNING** In linux with nodejs Version 18 the installation could be a challenge. If you don't intend communicate with Siemens PLCs via S7 you can remove the node-snap7 library from the server/package.json

```
cd ./server
npm install
npm start
```

**Open up a browser (better Chrome) and navigate to http://localhost:1881**


**Setting up as an HMI** ( Linux Only )

This has only been tested on linux, but some of the steps may work on Windows
 
We will use electron instead of a web browser, as it's not bloated and works well with Touch Screens ( can disable right click menu etc )

The app is only accessing the already running Fuxa Web Server 

`sudo apt-get update`

`curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -`

`sudo apt-get install -y nodejs`


Verify the installation by checking the versions of Node.js and npm:

`node -v`

`npm -v`

`sudo npm install -g electron --unsafe-perm=true --allow-root`

```
cd /opt 
sudo mkdir electron
cd electron
sudo mkdir fuxa-electron
cd fuxa-electron
```

`sudo npm init -y`

`sudo npm install electron --save-dev`

`sudo nano main.js`

```
const { app, BrowserWindow } = require('electron');

function createWindow() {
  const win = new BrowserWindow({
    //width: 800,
    //height: 600,
    fullscreen: true, // Enable full-screen mode
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  win.loadURL('http://localhost:1881'); // Replace with your web server URL
}

app.whenReady().then(createWindow);
```

`sudo nano package.json`

```
{
  "name": "fuxa-electron",
  "version": "1.0.0",
  "main": "main.js",
  "scripts": {
    "start": "electron ."
  },
  "description": "",
  "devDependencies": {
    "electron": "^31.3.1"
  }
}
```

Start the app from within the directory to test

`npm start`

Setup auto startup using a system service and a script

`sudo nano /opt/fuxa-electron-startup.sh`

```
#!/bin/bash
cd /opt/electron/fuxa-electron
npm start
```

`sudo chmod +x /opt/fuxa-electron-startup.sh`

`systemctl edit --user --force --full fuxa-electron-startup.service`

```
[Unit]
Description=Start Fuxa Electron Script
After=default.target
[Service]
ExecStart=/opt/fuxa-electron-startup.sh
[Install]
WantedBy=default.target
```

`systemctl enable --user fuxa-electron-startup.service` 