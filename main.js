const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

function getDataFilePath() {
  return path.join(__dirname, 'inventory.json');
}

function ensureDataFile() {
  try {
    const dataFile = getDataFilePath();
    if (!fs.existsSync(dataFile)) {
      fs.writeFileSync(dataFile, JSON.stringify([]));
    }
  } catch (err) {
    console.error('Failed to create data file', err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  ensureDataFile();
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers for reading and writing inventory
ipcMain.handle('read-inventory', async () => {
  ensureDataFile();
  const raw = fs.readFileSync(getDataFilePath(), 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
});

ipcMain.handle('write-inventory', async (event, items) => {
  try {
    fs.writeFileSync(getDataFilePath(), JSON.stringify(items, null, 2));
    return { success: true };
  } catch (err) {
    console.error(err);
    return { success: false, error: err.message };
  }
});



