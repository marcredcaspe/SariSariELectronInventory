const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  readInventory: () => ipcRenderer.invoke('read-inventory'),
  writeInventory: (items) => ipcRenderer.invoke('write-inventory', items)
});
