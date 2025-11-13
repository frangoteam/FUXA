const { app, BrowserWindow, Menu, dialog, shell, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('fs').promises;
const os = require('os');
const { fork } = require('child_process');

// Helper function to get correct preload script path for dev and production
function getPreloadPath() {
    if (!app.isPackaged) {
        return path.join(__dirname, 'preload.js');
    } else {
        // Production build - preload script is in resources directory
        return path.join(process.resourcesPath, 'preload.js');
    }
}

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
        // Initialize auto-start settings if not present
        if (!config.autoStart) {
            config.autoStart = { enabled: false, projectPath: null };
        }
        // Initialize fullscreen settings if not present
        if (!config.fullscreen) {
            config.fullscreen = { enabled: false };
        }
        return config;
    } catch (error) {
        return { recentProjects: [], autoStart: { enabled: false, projectPath: null }, fullscreen: { enabled: false } };
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
function createProjectSelectionWindow(parentWin, errorMessage = null, recentProjects = []) {
    const win = new BrowserWindow({
        width: 600,
        height: 500,
        minWidth: 400,
        minHeight: 350,
        parent: parentWin,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: getPreloadPath()
        },
        resizable: true
    });
    win.setMenu(null);

    const errorHtml = errorMessage ? `<div style="color: #ff6b6b; margin-bottom: 15px; padding: 10px; background-color: #2d2d2d; border: 1px solid #ff9999; border-radius: 5px; text-align: center;">${errorMessage}</div>` : '';

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>FUXA Project Selection</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 15px;
                    background-color: #424242;
                    color: #FFFFFF;
                    height: 100vh;
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                h2 {
                    text-align: center;
                    color: #FFFFFF;
                    margin-bottom: 15px;
                    flex-shrink: 0;
                }
                .table-container {
                    flex: 1;
                    overflow-y: auto;
                    margin-bottom: 15px;
                    border: 1px solid rgba(39,39,39,0.42);
                    border-radius: 5px;
                    min-height: 200px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    background-color: #37373D;
                    table-layout: fixed;
                }
                th {
                    background-color: #333333;
                    color: #FFFFFF;
                    padding: 12px 8px;
                    text-align: left;
                    position: sticky;
                    top: 0;
                    z-index: 1;
                    font-size: 14px;
                }
                th:nth-child(1) { width: 25%; }
                th:nth-child(2) { width: 50%; }
                th:nth-child(3) { width: 25%; }
                td {
                    padding: 10px 8px;
                    border-bottom: 1px solid rgba(39,39,39,0.42);
                    cursor: pointer;
                    font-size: 13px;
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                }
                tr:nth-child(even) {
                    background-color: #424242;
                }
                tr:hover {
                    background-color: rgba(255, 255, 255, 0.1);
                }
                .button-container {
                    flex-shrink: 0;
                    text-align: center;
                    padding-top: 10px;
                    display: flex;
                    justify-content: center;
                    gap: 10px;
                    border-top: 1px solid rgba(39,39,39,0.42);
                    margin-top: auto;
                    padding-bottom: 10px;
                }
                button {
                    padding: 8px 12px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 13px;
                    width: auto;
                    min-width: 80px;
                    max-width: 120px;
                }
                button.new, button.cancel {
                    background-color: #757575;
                    color: #FFFFFF;
                }
                button.open {
                    background-color: #448AFF;
                    color: #FFFFFF;
                }
                button:hover {
                    opacity: 0.9;
                }
                @media (max-width: 500px) {
                    body {
                        padding: 10px;
                    }
                    h2 {
                        font-size: 16px;
                        margin-bottom: 10px;
                    }
                    th, td {
                        padding: 8px 4px;
                        font-size: 12px;
                    }
                    button {
                        padding: 6px 8px;
                        font-size: 12px;
                        min-width: 70px;
                    }
                }
            </style>
        </head>
        <body>
            <h2>Select a FUXA Project</h2>
            ${errorHtml}
            <div class="table-container">
                <table id="projectsTable">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Path</th>
                            <th>Created</th>
                        </tr>
                    </thead>
                    <tbody id="projectsBody">
                        ${recentProjects.map(project => `
                            <tr onclick="window.electronAPI.selectProject('${project.path.replace(/'/g, '\\\'')}')">
                                <td>${project.name}</td>
                                <td>${project.path}</td>
                                <td>${new Date(project.createdAt).toLocaleDateString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="button-container">
                <button class="new" onclick="window.electronAPI.selectAction('new')">New Project</button>
                <button class="open" onclick="window.electronAPI.selectAction('open')">Open Project</button>
                <button class="cancel" onclick="window.electronAPI.cancel()">Cancel</button>
            </div>
        </body>
        </html>
    `;

    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    return win;
}

// Handle project selection
async function selectProject(parentWin, errorMessage = null) {
    return new Promise(async (resolve) => {
        // Load config first
        let recentProjects = [];
        try {
            const config = await loadConfig();
            recentProjects = config.recentProjects || [];
        } catch (error) {
            console.error('Failed to load projects:', error.message);
        }

        const selectionWin = createProjectSelectionWindow(parentWin, errorMessage, recentProjects);

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

// Create settings window
async function openSettingsWindow(parentWin) {
    const settingsWin = new BrowserWindow({
        width: 500,
        height: 300,
        minWidth: 400,
        minHeight: 250,
        parent: parentWin,
        modal: true,
        resizable: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: getPreloadPath()
        },
        show: false
    });

    settingsWin.setMenu(null);

    const config = await loadConfig();
    const recentProjects = config.recentProjects || [];
    const autoStart = config.autoStart;
    const fullscreen = config.fullscreen;

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>FUXA Settings</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 15px;
                    background-color: #424242;
                    color: #FFFFFF;
                    height: 100vh;
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                h2 {
                    text-align: center;
                    color: #FFFFFF;
                    margin-top: 0;
                    margin-bottom: 15px;
                    flex-shrink: 0;
                }
                .setting-group {
                    flex: 1;
                    margin-bottom: 15px;
                    padding: 15px;
                    background-color: #37373D;
                    border-radius: 5px;
                    border: 1px solid rgba(39,39,39,0.42);
                    overflow-y: auto;
                }
                .setting-item {
                    margin-bottom: 10px;
                }
                label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: bold;
                    color: #FFFFFF;
                }
                select, button {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    border-radius: 4px;
                    font-size: 14px;
                    background-color: #424242;
                    color: #FFFFFF;
                    max-width: none;
                }
                select:focus, button:focus {
                    outline: none;
                    border-color: rgba(255, 255, 255, 0.5);
                }
                .checkbox-container {
                    display: flex;
                    align-items: center;
                }
                .checkbox-container input[type="checkbox"] {
                    margin-right: 10px;
                    width: auto;
                    accent-color: #FFFFFF;
                }
                .button-container {
                    flex-shrink: 0;
                    text-align: center;
                    margin-top: auto;
                    padding-top: 10px;
                    display: flex;
                    justify-content: center;
                    gap: 10px;
                    border-top: 1px solid rgba(39,39,39,0.42);
                    padding-bottom: 10px;
                }
                button {
                    padding: 8px 12px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 13px;
                    width: auto;
                    min-width: 70px;
                    max-width: 100px;
                }
                button.save {
                    background-color: #448AFF;
                    color: #FFFFFF;
                }
                button.cancel {
                    background-color: #757575;
                    color: #FFFFFF;
                }
                button:hover {
                    opacity: 0.9;
                }
                .disabled {
                    opacity: 0.5;
                    pointer-events: none;
                }
                @media (max-width: 450px) {
                    body {
                        padding: 10px;
                    }
                    h2 {
                        font-size: 16px;
                        margin-bottom: 10px;
                    }
                    .setting-group {
                        padding: 10px;
                    }
                    .setting-item {
                        margin-bottom: 12px;
                    }
                    select, button {
                        font-size: 12px;
                    }
                    button {
                        padding: 6px 8px;
                        min-width: 60px;
                    }
                }
            </style>
        </head>
        <body>
            <h2>FUXA Settings</h2>
            <div class="setting-group">
                <div class="setting-item">
                    <label class="checkbox-container">
                        <input type="checkbox" id="autoStartEnabled" ${autoStart.enabled ? 'checked' : ''}>
                        Enable Auto Start
                    </label>
                </div>
                <div class="setting-item">
                    <label class="checkbox-container">
                        <input type="checkbox" id="fullscreenEnabled" ${fullscreen.enabled ? 'checked' : ''}>
                        Start in Fullscreen Mode
                    </label>
                </div>
                <div class="setting-item">
                    <label for="autoStartProject">Auto Start Project:</label>
                    <select id="autoStartProject" ${!autoStart.enabled ? 'disabled' : ''}>
                        <option value="">Select a project...</option>
                        ${recentProjects.map(project => 
                            `<option value="${project.path}" ${autoStart.projectPath === project.path ? 'selected' : ''}>${project.name}</option>`
                        ).join('')}
                    </select>
                </div>
            </div>
            <div class="button-container">
                <button class="save" onclick="saveSettings()">Save</button>
                <button class="cancel" onclick="window.close()">Cancel</button>
            </div>
            <script>
                // Enable/disable project dropdown based on checkbox
                document.getElementById('autoStartEnabled').addEventListener('change', function() {
                    const select = document.getElementById('autoStartProject');
                    select.disabled = !this.checked;
                    if (!this.checked) {
                        select.classList.add('disabled');
                    } else {
                        select.classList.remove('disabled');
                    }
                });

                async function saveSettings() {
                    const enabled = document.getElementById('autoStartEnabled').checked;
                    const projectPath = enabled ? document.getElementById('autoStartProject').value : null;
                    const fullscreenEnabled = document.getElementById('fullscreenEnabled').checked;
                    
                    try {
                        await window.electronAPI.setAutoStartSettings({ enabled, projectPath });
                        await window.electronAPI.setFullscreenSettings({ enabled: fullscreenEnabled });
                        alert('Settings saved successfully!');
                        window.close();
                    } catch (error) {
                        alert('Failed to save settings: ' + error.message);
                    }
                }
            </script>
        </body>
        </html>
    `;

    settingsWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    settingsWin.show();
}

// Create main window
function createWindow() {
    const win = new BrowserWindow({
        width: 1024,
        height: 768,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: getPreloadPath()
        }
    });

    // Load initial loading screen
    const loadingHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>FUXA - Loading...</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 0;
                    background-color: #424242;
                    color: #FFFFFF;
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    overflow: hidden;
                }
                .loading-container {
                    text-align: center;
                }
                .spinner {
                    width: 60px;
                    height: 60px;
                    border: 4px solid rgba(255, 255, 255, 0.3);
                    border-top: 4px solid #448AFF;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 20px;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                h1 {
                    color: #FFFFFF;
                    margin-bottom: 10px;
                    font-size: 24px;
                }
                p {
                    color: rgba(255, 255, 255, 0.8);
                    font-size: 16px;
                    margin: 0;
                }
            </style>
        </head>
        <body>
            <div class="loading-container">
                <div class="spinner"></div>
                <h1>FUXA</h1>
                <p>Starting server...</p>
            </div>
        </body>
        </html>
    `;
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(loadingHtml)}`);

    // Check fullscreen settings
    loadConfig().then(config => {
        if (config.fullscreen && config.fullscreen.enabled) {
            win.setFullScreen(true);
        } else {
            win.maximize(); // Start window maximized only if not in fullscreen
        }
    }).catch(() => {
        win.maximize(); // Fallback to maximized if config loading fails
    });

    const menu = Menu.buildFromTemplate([
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Project',
                    click: async () => {
                        try {
                            const dataDir = await createNewProject(win);
                            if (dataDir) {
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
                        try {
                            const dataDir = await openProject(win);
                            if (dataDir) {
                                await restartApp(dataDir, win);
                            }
                        } catch (error) {
                            console.error('Open project failed:', error.message);
                            await dialog.showErrorBox('FUXA Error', `Open project failed: ${error.message}`);
                        }
                    }
                },
                {
                    label: 'Settings',
                    click: async () => {
                        await openSettingsWindow(win);
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
        // In development, server is at ../server/main.js
        // In production, it's in the resources directory
        let serverEntry;
        if (!app.isPackaged) {
            serverEntry = path.join(__dirname, '../server/main.js');
        } else {
            // Production build - server files are in resources directory
            serverEntry = path.join(process.resourcesPath, 'server', 'main.js');
        }
        
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
        // Update loading screen to show FUXA is loading
        const loadingFuxaHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>FUXA - Loading...</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        margin: 0;
                        padding: 0;
                        background-color: #424242;
                        color: #FFFFFF;
                        height: 100vh;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                        overflow: hidden;
                    }
                    .loading-container {
                        text-align: center;
                    }
                    .spinner {
                        width: 60px;
                        height: 60px;
                        border: 4px solid rgba(255, 255, 255, 0.3);
                        border-top: 4px solid #448AFF;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 20px;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    h1 {
                        color: #FFFFFF;
                        margin-bottom: 10px;
                        font-size: 24px;
                    }
                    p {
                        color: rgba(255, 255, 255, 0.8);
                        font-size: 16px;
                        margin: 0;
                    }
                </style>
            </head>
            <body>
                <div class="loading-container">
                    <div class="spinner"></div>
                    <h1>FUXA</h1>
                    <p>Loading application...</p>
                </div>
            </body>
            </html>
        `;
        await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(loadingFuxaHtml)}`);
        
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds for server
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

// IPC handlers for auto-start settings
ipcMain.handle('get-auto-start-settings', async () => {
    const config = await loadConfig();
    return config.autoStart;
});

ipcMain.handle('set-auto-start-settings', async (event, settings) => {
    const config = await loadConfig();
    config.autoStart = settings;
    await saveConfig(config);
    return true;
});

ipcMain.handle('get-fullscreen-settings', async () => {
    const config = await loadConfig();
    return config.fullscreen;
});

ipcMain.handle('set-fullscreen-settings', async (event, settings) => {
    const config = await loadConfig();
    config.fullscreen = settings;
    await saveConfig(config);
    return true;
});

ipcMain.handle('get-recent-projects', async () => {
    const config = await loadConfig();
    return config.recentProjects || [];
});

// App startup
app.whenReady().then(async () => {
    console.log('App starting');
    await ensureConfigDir();

    const args = process.argv.slice(1);
    const dataDirArg = args.find(arg => arg.startsWith('--dataDir='));
    let dataDir = dataDirArg ? dataDirArg.split('=')[1] : null;

    const win = createWindow();
    
    if (!dataDir) {
        // Check auto-start settings
        const config = await loadConfig();
        if (config.autoStart && config.autoStart.enabled && config.autoStart.projectPath) {
            try {
                // Check if the auto-start project exists
                const projectDataDir = path.join(config.autoStart.projectPath, 'data');
                await fs.access(projectDataDir);
                console.log(`Auto-starting with project: ${config.autoStart.projectPath}`);
                dataDir = projectDataDir;
            } catch (error) {
                console.log(`Auto-start project not found: ${config.autoStart.projectPath}`);
                // Show project selector with error
                dataDir = await selectProject(win, `Auto-start project not found: ${config.autoStart.projectPath}`);
            }
        } else {
            dataDir = await selectProject(win);
        }
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
