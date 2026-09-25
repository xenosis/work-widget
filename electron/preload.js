const { contextBridge, ipcRenderer } = require('electron');

// P1.6: 트레이에서 숨겼다가(destroy 아님, B5.1) 다시 보여질 때 main이 'data:changed'를 쏘면
// 렌더러(useAppData.js)가 이를 구독해 loadData()를 다시 부른다 — 리스너 등록/해제를 구독자가
// 직접 하지 않도록 unsubscribe 함수를 돌려준다.
contextBridge.exposeInMainWorld('api', {
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (data) => ipcRenderer.invoke('data:save', data),
  onDataChanged: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('data:changed', listener);
    return () => ipcRenderer.removeListener('data:changed', listener);
  },
});
