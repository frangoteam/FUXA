const { app, BrowserWindow, Menu, dialog, shell, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('fs').promises;
const os = require('os');
const { fork } = require('child_process');

// Global server process
let serverProcess = null;

// App configuration directory (stores config.json for recent projects)
const appData = process.env.APPDATA || (process.platform === 'darwin' ? os.homedir() + '/Library/Application Support' : os.homedir() + '/.local/share');
const configDir = path.join(appData, 'fuxa-app');
const configPath = path.join(configDir, 'config.json');

// Ensure config directory exists
async function ensureConfigDir() {
    try {
        await fs.mkdir(configDir, { recursive: true });
    } catch (error) {
        console.error('Failed to create config directory:', error.message);
    }
}

// Load or initialize config, validating project paths
async function loadConfig() {
    try {
        const data = await fs.readFile(configPath, 'utf8');
        const config = JSON.parse(data);
        const validProjects = [];
        for (const project of config.recentProjects || []) {
            try {
                await fs.access(project.path);
                validProjects.push(project);
            } catch (error) {
                console.log(`Removing invalid project path: ${project.path}`);
            }
        }
        config.recentProjects = validProjects;
        if (validProjects.length !== (config.recentProjects?.length || 0)) {
            await saveConfig(config);
        }
        return config;
    } catch (error) {
        return { recentProjects: [] };
    }
}

// Save config
async function saveConfig(config) {
    try {
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('Failed to save config:', error.message);
    }
}

// Add project to recent projects
async function addRecentProject(projectDir, projectName) {
    try {
        const config = await loadConfig();
        const newProject = {
            name: projectName || path.basename(projectDir),
            path: projectDir,
            createdAt: new Date().toISOString()
        };
        config.recentProjects = (config.recentProjects || []).filter(p => p.path !== projectDir);
        config.recentProjects.unshift(newProject);
        if (config.recentProjects.length > 5) config.recentProjects.pop();
        await saveConfig(config);
    } catch (error) {
        console.error('Failed to add recent project:', error.message);
    }
}

// Create new project with custom name
async function createNewProject(parentWin) {
    try {
        const { canceled, filePath } = await dialog.showSaveDialog(parentWin, {
            title: 'Create New Project',
            defaultPath: path.join(os.homedir(), 'FUXA-Project'),
            buttonLabel: 'Create',
            filters: [{ name: 'FUXA Project', extensions: [''] }],
            properties: ['createDirectory']
        });
        if (canceled || !filePath) return null;

        const projectDir = filePath;
        const projectName = path.basename(filePath);
        await fs.mkdir(projectDir, { recursive: true });
        const dataDir = path.join(projectDir, 'data');
        await fs.mkdir(dataDir, { recursive: true });
        await addRecentProject(projectDir, projectName);
        return dataDir;
    } catch (error) {
        console.error('Error:', error.message);
        await dialog.showErrorBox('FUXA Error', `Failed to create project: ${error.message}`);
        return null;
    }
}

// Open existing project
async function openProject(parentWin) {
    try {
        const { canceled, filePaths } = await dialog.showOpenDialog(parentWin, {
            properties: ['openDirectory'],
            title: 'Open Project Folder'
        });
        if (canceled || !filePaths[0]) return null;

        const projectDir = filePaths[0];
        const dataDir = path.join(projectDir, 'data');
        await fs.access(dataDir);
        await addRecentProject(projectDir, path.basename(projectDir));
        return dataDir;
    } catch (error) {
        console.error('Failed to open project:', error.message);
        await dialog.showErrorBox('FUXA Error', `Invalid project: ${error.message}`);
        return null;
    }
}

// Create project selection window
function createProjectSelectionWindow(parentWin) {
    const win = new BrowserWindow({
        width: 600,
        height: 400,
        parent: parentWin,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            sandbox: false // Disable renderer sandbox
        },
        resizable: false
    });
    win.setMenu(null);

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>FUXA Project Selection</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 20px;
                    background-color: #f4f4f4;
                    color: #333;
                }
                h2 {
                    text-align: center;
                    color: #444;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                    background-color: white;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                }
                th, td {
                    padding: 10px;
                    text-align: left;
                    border-bottom: 1px solid #ddd;
                    cursor: pointer;
                }
                th {
                    background-color: #007bff;
                    color: white;
                }
                tr:hover {
                    background-color: #e9ecef;
                }
                .button-container {
                    text-align: center;
                }
                button {
                    padding: 10px 20px;
                    margin: 0 10px;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 16px;
                }
                button.new {
                    background-color: #28a745;
                    color: white;
                }
                button.open {
                    background-color: #007bff;
                    color: white;
                }
                button.cancel {
                    background-color: #dc3545;
                    color: white;
                }
                button:hover {
                    opacity: 0.9;
                }
            </style>
        </head>
        <body>
            <h2>Select a FUXA Project</h2>
            <table id="projectsTable">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Path</th>
                        <th>Created</th>
                    </tr>
                </thead>
                <tbody id="projectsBody"></tbody>
            </table>
            <div class="button-container">
                <button class="new" onclick="window.electronAPI.selectAction('new')">New Project</button>
                <button class="open" onclick="window.electronAPI.selectAction('open')">Open Project</button>
                <button class="cancel" onclick="window.electronAPI.cancel()">Cancel</button>
            </div>
            <script>
                const { ipcRenderer } = require('electron');
                window.electronAPI = {
                    selectAction: (action) => ipcRenderer.send('project-action', action),
                    selectProject: (path) => ipcRenderer.send('project-selected', path),
                    cancel: () => ipcRenderer.send('project-action', 'cancel')
                };
                ipcRenderer.on('load-projects', (event, projects) => {
                    const tbody = document.getElementById('projectsBody');
                    tbody.innerHTML = '';
                    projects.forEach(project => {
                        const row = document.createElement('tr');
                        row.innerHTML = \`
                            <td>\${project.name}</td>
                            <td>\${project.path}</td>
                            <td>\${new Date(project.createdAt).toLocaleDateString()}</td>
                        \`;
                        row.onclick = () => window.electronAPI.selectProject(project.path);
                        tbody.appendChild(row);
                    });
                });
            </script>
        </body>
        </html>
    `;

    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    return win;
}

// Handle project selection
async function selectProject(parentWin) {
    return new Promise((resolve) => {
        const selectionWin = createProjectSelectionWindow(parentWin);

        loadConfig().then(config => {
            selectionWin.webContents.send('load-projects', config.recentProjects || []);
        }).catch(error => {
            console.error('Failed to load projects:', error.message);
            selectionWin.close();
            resolve(null);
        });

        ipcMain.once('project-action', async (event, action) => {
            let dataDir = null;
            if (action === 'new' || action === 'open') {
                selectionWin.hide();
                if (action === 'new') {
                    dataDir = await createNewProject(parentWin);
                } else {
                    dataDir = await openProject(parentWin);
                }
                if (!dataDir) {
                    selectionWin.show();
                }
            }
            selectionWin.close();
            resolve(dataDir);
        });

        ipcMain.once('project-selected', (event, projectPath) => {
            const dataDir = path.join(projectPath, 'data');
            selectionWin.close();
            resolve(dataDir);
        });

        selectionWin.on('closed', () => {
            ipcMain.removeAllListeners('project-action');
            ipcMain.removeAllListeners('project-selected');
            resolve(null);
        });
    });
}

// Create main window
function createWindow() {
    console.log('Creating new window');
    const win = new BrowserWindow({
        width: 1024,
        height: 768,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            sandbox: false // Disable renderer sandbox
        }
    });

    win.maximize(); // Start window maximized

    const menu = Menu.buildFromTemplate([
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Project',
                    click: async () => {
                        console.log('File > New Project clicked');
                        try {
                            const dataDir = await createNewProject(win);
                            if (dataDir) {
                                console.log(`New project selected: ${dataDir}`);
                                await restartApp(dataDir, win);
                            }
                        } catch (error) {
                            console.error('New project failed:', error.message);
                            await dialog.showErrorBox('FUXA Error', `New project failed: ${error.message}`);
                        }
                    }
                },
                {
                    label: 'Open Project',
                    click: async () => {
                        console.log('File > Open Project clicked');
                        try {
                            const dataDir = await openProject(win);
                            if (dataDir) {
                                console.log(`Open project selected: ${dataDir}`);
                                await restartApp(dataDir, win);
                            }
                        } catch (error) {
                            console.error('Open project failed:', error.message);
                            await dialog.showErrorBox('FUXA Error', `Open project failed: ${error.message}`);
                        }
                    }
                },
                { type: 'separator' },
                { role: 'quit' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools', visible: process.env.NODE_ENV === 'development' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' },
                { role: 'minimize' },
                { role: 'zoom', label: 'Maximize', click: () => win.maximize() }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'FUXA Documentation',
                    click: () => shell.openExternal('https://github.com/frangoteam/FUXA/wiki')
                }
            ]
        }
    ]);
    Menu.setApplicationMenu(menu);

    return win;
}

// Restart FUXA server with new dataDir
async function restartApp(dataDir, win) {
    console.log(`Restarting app with dataDir: ${dataDir}`);

    // Stop existing server process
    if (serverProcess) {
        console.log('Stopping server process');
        serverProcess.kill('SIGTERM');
        await new Promise(resolve => {
            serverProcess.on('close', () => {
                console.log('Server process stopped');
                resolve();
            });
            setTimeout(resolve, 1000); // 1-second timeout
        });
        serverProcess = null;
    }

    // Start new server process
    try {
        const serverEntry = path.join(__dirname, 'server/main.js');
        if (!require('fs').existsSync(serverEntry)) {
            throw new Error(`Server file not found: ${serverEntry}`);
        }
        serverProcess = fork(serverEntry, [], {
            env: { ...process.env, userDir: dataDir, PORT: 1881 },
            silent: false
        });
        serverProcess.on('error', (error) => {
            console.error('Server process error:', error.message);
        });
        console.log(`Server started with dataDir: ${dataDir}`);
    } catch (error) {
        console.error(`Failed to start server: ${error.message}`);
        await dialog.showErrorBox('FUXA Error', `Failed to start server: ${error.message}`);
        return;
    }

    // Reload UI
    try {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds for server
        await win.loadURL('http://localhost:1881');
        console.log('UI loaded: http://localhost:1881');
    } catch (error) {
        console.error('Failed to load UI:', error.message);
        await dialog.showErrorBox('FUXA Error', `Failed to load UI: ${error.message}`);
    }
}

// Start FUXA server and load UI
async function startApp(dataDir, win) {
    await restartApp(dataDir, win);
}

// App startup
app.whenReady().then(async () => {
    console.log('App starting');
    await ensureConfigDir();

    const args = process.argv.slice(1);
    const dataDirArg = args.find(arg => arg.startsWith('--dataDir='));
    let dataDir = dataDirArg ? dataDirArg.split('=')[1] : null;

    const win = createWindow();
    if (!dataDir) {
        dataDir = await selectProject(win);
    }

    if (dataDir) {
        await startApp(dataDir, win);
    } else {
        console.log('No project selected, closing');
        win.close();
    }
});

app.on('window-all-closed', () => {
    console.log('All windows closed');
    if (serverProcess) {
        serverProcess.kill('SIGTERM');
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    console.log('App activated');
    if (BrowserWindow.getAllWindows().length === 0) {
        const win = createWindow();
        selectProject(win).then(dataDir => {
            if (dataDir) {
                startApp(dataDir, win);
            } else {
                console.log('No project selected, closing');
                win.close();
            }
        });
    }
});
