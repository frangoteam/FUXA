const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script loaded');

contextBridge.exposeInMainWorld('electronAPI', {
    // Auto-start settings
    getAutoStartSettings: () => ipcRenderer.invoke('get-auto-start-settings'),
    setAutoStartSettings: (settings) => ipcRenderer.invoke('set-auto-start-settings', settings),
    // Fullscreen settings
    getFullscreenSettings: () => ipcRenderer.invoke('get-fullscreen-settings'),
    setFullscreenSettings: (settings) => ipcRenderer.invoke('set-fullscreen-settings', settings),
    getRecentProjects: () => ipcRenderer.invoke('get-recent-projects'),
    // Project selection (for backward compatibility)
    selectAction: (action) => ipcRenderer.send('project-action', action),
    selectProject: (path) => ipcRenderer.send('project-selected', path),
    cancel: () => ipcRenderer.send('project-action', 'cancel')
});