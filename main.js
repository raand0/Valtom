const { app, BrowserWindow } = require('electron');
const remoteMain = require('@electron/remote/main');
remoteMain.initialize();

let win;
app.whenReady().then(()=>{
  win = new BrowserWindow({
    show : false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });
  remoteMain.enable(win.webContents);
  win.setMenu(null);
  win.setMinimumSize(800, 500);
  win.maximize();
  win.loadFile('index.html');
  //win.webContents.openDevTools(); // opens DevTools automatically
});
