/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('webhmiPicker', {
  onDevices(handler) {
    if (typeof handler !== 'function') return () => {};
    const listener = (_event, type, devices, lang) => handler(type, devices, lang);
    ipcRenderer.on('devices', listener);
    return () => ipcRenderer.removeListener('devices', listener);
  },
  selectDeviceResult(deviceId) {
    ipcRenderer.send('device-selected', deviceId || null);
  }
});
