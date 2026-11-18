const { contextBridge, ipcRenderer } = require('electron');
// 画面から呼べるのは「書き出し」だけ
contextBridge.exposeInMainWorld('native', {
  saveExport: (o) => ipcRenderer.invoke('save-export', o),
});
