const { app, BrowserWindow } = require('electron');

let win;
app.whenReady().then(()=>{
  win = new BrowserWindow({
    show : false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });
  win.setMenu(null);
  win.setMinimumSize(800, 500);
  win.maximize();
  win.loadFile('index.html');
  //win.webContents.openDevTools(); // opens DevTools automatically
});
