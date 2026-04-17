const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

app.commandLine.appendSwitch('enable-features', 'WebBluetooth');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'WebHMI',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../dist/favicon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webBluetooth: true
    }
  });

  mainWindow.removeMenu();

  // 阻止 Electron 自动把网页的 <title> 标签内容同步覆盖到窗口标题上
  mainWindow.on('page-title-updated', (evt) => {
    evt.preventDefault();
  });

  if (!app.isPackaged) {
    // Development mode: load from Vite dev server
    mainWindow.loadURL('http://localhost:3003');
  } else {
    // Production mode: load local build files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // 用于在多次扫描期间保存当前的弹窗实例和回调
  let pickerWindow = null;
  let deviceCallback = null;

  const updateOrCreatePicker = async (type, deviceList, callback) => {
    deviceCallback = callback;

    const langRaw = await mainWindow.webContents.executeJavaScript('localStorage.getItem("webhmi_lang") || "en"').catch(() => 'en');
    const lang = langRaw && langRaw.toLowerCase().startsWith('zh') ? 'zh' : 'en';

    if (pickerWindow && !pickerWindow.isDestroyed()) {
      pickerWindow.webContents.send('devices', type, deviceList, lang);
      return;
    }

    pickerWindow = new BrowserWindow({
      parent: mainWindow,
      modal: true,
      width: 400,
      height: 450,
      show: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      titleBarStyle: 'hidden',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    pickerWindow.loadFile(path.join(__dirname, 'picker.html'));

    pickerWindow.once('ready-to-show', () => {
      pickerWindow.webContents.send('devices', type, deviceList, lang);
      pickerWindow.show();
    });

    pickerWindow.on('closed', () => {
      pickerWindow = null;
      // 如果窗体被用户强行关闭（点击X），通过回调传入空字符串中断请求
      if (deviceCallback) {
        try {
          deviceCallback('');
        } catch (e) {}
        deviceCallback = null;
      }
    });
  };

  // 全局只监听一次 device-selected 事件即可，避免内存泄漏
  ipcMain.removeAllListeners('device-selected');
  ipcMain.on('device-selected', (event, deviceId) => {
    if (pickerWindow && !pickerWindow.isDestroyed()) {
      pickerWindow.close(); // 会触发上面的 closed 事件，但我们要在这之前提取 callback
    }
    const cb = deviceCallback;
    deviceCallback = null; // 置空避免重复调用
    if (cb) {
      try {
        cb(deviceId || '');
      } catch (e) {}
    }
  });

  // Handle Web Bluetooth device selection (emitted on webContents)
  mainWindow.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
    event.preventDefault();
    updateOrCreatePicker('bluetooth', deviceList, callback);
  });

  // Handle Web Bluetooth pairing (if required, on session)
  mainWindow.webContents.session.setBluetoothPairingHandler((details, callback) => {
    console.log('Bluetooth Pairing Required:', details);
    callback({
      pin: '0000', // Default PIN
      accept: true
    });
  });

  // Handle WebHID device selection
  mainWindow.webContents.session.on('select-hid-device', (event, details, callback) => {
    event.preventDefault();
    updateOrCreatePicker('hid', details.deviceList, callback);
  });

  // Automatically grant device permissions for HID
  mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    if (permission === 'hid' || permission === 'bluetooth') {
      return true;
    }
    return true; 
  });

  mainWindow.webContents.session.setDevicePermissionHandler((details) => {
    if (details.deviceType === 'hid' || details.deviceType === 'bluetooth') {
      return true;
    }
    return false;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
