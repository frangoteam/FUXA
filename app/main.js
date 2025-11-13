const { app, BrowserWindow, Menu, dialog, shell, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('fs').promises;
const os = require('os');
const { fork } = require('child_process');
const { pathToFileURL } = require('url');

// Global server process
let serverProcess = null;

// Helper function to get recent projects menu items
function getRecentProjectsMenuItems(win) {
    try {
        const config = loadConfigSync();
        const recentProjects = config.recentProjects || [];
        
        if (recentProjects.length === 0) {
            return [{ label: 'No recent projects', enabled: false }];
        }
        
        return recentProjects.map(project => ({
            label: `${project.name} (${project.path})`,
            click: async () => {
                try {
                    const dataDir = path.join(project.path, 'data');
                    const appDataDir = path.join(dataDir, '_appdata');
                    
                    // Validate the project still exists and is valid
                    await fs.access(dataDir);
                    await fs.access(appDataDir);
                    
                    await restartApp(dataDir, win);
                } catch (error) {
                    console.error('Failed to open recent project:', error.message);
                    await dialog.showErrorBox('FUXA Error', `Failed to open project: ${error.message}`);
                    
                    // Remove invalid project from recent list
                    removeRecentProject(project.path);
                }
            }
        }));
    } catch (error) {
        console.error('Failed to load recent projects for menu:', error.message);
        return [{ label: 'Error loading recent projects', enabled: false }];
    }
}

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

// Load or initialize config synchronously (for menu building)
function loadConfigSync() {
    try {
        const data = require('fs').readFileSync(configPath, 'utf8');
        const config = JSON.parse(data);
        return config;
    } catch (error) {
        return { recentProjects: [], autoStart: { enabled: false, projectPath: null }, fullscreen: { enabled: false } };
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

// Remove a project from recent projects list
async function removeRecentProject(projectPath) {
    try {
        const config = await loadConfig();
        config.recentProjects = (config.recentProjects || []).filter(p => p.path !== projectPath);
        await saveConfig(config);
    } catch (error) {
        console.error('Failed to remove recent project:', error.message);
    }
}

// Open existing project
async function openProject(parentWin) {
    try {
        const { canceled, filePaths } = await dialog.showOpenDialog(parentWin, {
            properties: ['openDirectory'],
            title: 'Open Project Folder',
            defaultPath: os.homedir()
        });
        if (canceled || !filePaths[0]) return null;

        const projectDir = filePaths[0];
        const dataDir = path.join(projectDir, 'data');
        const appDataDir = path.join(dataDir, '_appdata');
        
        // Check if this is a valid FUXA project
        await fs.access(dataDir);
        await fs.access(appDataDir);
        
        await addRecentProject(projectDir, path.basename(projectDir));
        return dataDir;
    } catch (error) {
        console.error('Failed to open project:', error.message);
        await dialog.showErrorBox('FUXA Error', `Invalid project: The selected folder is not a valid FUXA project. Please select a folder containing a 'data/_appdata' directory.`);
        return null;
    }
}

// Create project selection window
async function createProjectSelectionWindow(parentWin, errorMessage = null, recentProjects = []) {
    const win = new BrowserWindow({
        width: 600,
        height: 500,
        minWidth: 400,
        minHeight: 350,
        parent: parentWin,
        modal: true,
        resizable: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            sandbox: false // Disable renderer sandbox
        },
        show: false
    });
    win.setMenu(null);

    // Load the HTML file
    const htmlPath = getHtmlPath('project-selection.html');
    win.loadURL(pathToFileURL(htmlPath).href);

    win.once('ready-to-show', () => {
        win.show();

        // Send projects data to the window
        win.webContents.send('load-projects', recentProjects);

        // Send error message if provided
        if (errorMessage) {
            win.webContents.send('show-error', errorMessage);
        }
    });

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

        const selectionWin = await createProjectSelectionWindow(parentWin, errorMessage, recentProjects);

        const actionHandler = async (event, action) => {
            let dataDir = null;
            if (action === 'new' || action === 'open') {
                selectionWin.hide();
                if (action === 'new') {
                    dataDir = await createNewProject(parentWin);
                } else {
                    dataDir = await openProject(parentWin);
                }
                if (dataDir) {
                    // Valid project selected
                    ipcMain.removeListener('project-action', actionHandler);
                    selectionWin.close();
                    resolve(dataDir);
                } else {
                    // User canceled, show window again
                    selectionWin.show();
                    // Keep listening for more actions
                }
            } else if (action === 'cancel') {
                // User explicitly canceled
                ipcMain.removeListener('project-action', actionHandler);
                selectionWin.close();
                resolve(null);
            }
        };

        ipcMain.on('project-action', actionHandler);

        ipcMain.once('project-selected', (event, projectPath) => {
            const dataDir = path.join(projectPath, 'data');
            ipcMain.removeListener('project-action', actionHandler);
            selectionWin.close();
            resolve(dataDir);
        });

        selectionWin.on('closed', () => {
            ipcMain.removeListener('project-action', actionHandler);
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
            nodeIntegration: true,
            contextIsolation: false,
            sandbox: false // Disable renderer sandbox
        },
        show: false
    });

    settingsWin.setMenu(null);

    // Load the HTML file
    const htmlPath = getHtmlPath('settings.html');
    settingsWin.loadURL(pathToFileURL(htmlPath).href);

    settingsWin.show();
}

// Helper function to get HTML file path (works in both dev and production)
function getHtmlPath(filename) {
    // HTML files are always in the same directory as main.js (app/)
    return require('path').join(__dirname, filename);
}

function getServerPath() {
    // Try same directory first (production), then parent directory (development)
    const prodPath = require('path').join(__dirname, 'server/main.js');
    if (require('fs').existsSync(prodPath)) {
        return prodPath;
    }
    // Fall back to development path
    return require('path').join(__dirname, '../server/main.js');
}

// Create main window
function createWindow() {
    const win = new BrowserWindow({
        width: 1024,
        height: 768,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            sandbox: false // Disable renderer sandbox
        }
    });

    // Load initial loading screen
    const htmlPath = getHtmlPath('loading.html');
    win.loadURL(pathToFileURL(htmlPath).href);

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
                    submenu: [
                        {
                            label: 'Browse...',
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
                        { type: 'separator' },
                        ...getRecentProjectsMenuItems(win)
                    ]
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
        const serverEntry = getServerPath();
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
        const htmlPath = getHtmlPath('loading.html');
        await win.loadURL(pathToFileURL(htmlPath).href);
        
        // Update loading text
        await win.webContents.executeJavaScript(`
            document.getElementById('loadingText').textContent = 'Loading application...';
        `);
        
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
