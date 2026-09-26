const { contextBridge, ipcRenderer } = require('electron');

// P1.6: 트레이에서 숨겼다가(destroy 아님, B5.1) 다시 보여질 때 main이 'data:changed'를 쏘면
// 렌더러(useAppData.js)가 이를 구독해 loadData()를 다시 부른다 — 리스너 등록/해제를 구독자가
// 직접 하지 않도록 unsubscribe 함수를 돌려준다.
// P12.3: frame:false로 네이티브 타이틀바를 없앤 대신 렌더러(TitleBar.jsx)가 최소화/최대화/
// 닫기 버튼을 직접 그린다 — 실제 창 제어는 메인 프로세스만 할 수 있으므로 IPC로 요청한다.
// 닫기는 mainWindow.close()만 호출하고 B5.1(트레이로 숨김) 로직 자체는 기존 'close' 이벤트
// 핸들러(electron/main.js)가 그대로 담당한다 — 여기서 따로 구현하지 않는다.
contextBridge.exposeInMainWorld('api', {
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (data) => ipcRenderer.invoke('data:save', data),
  onDataChanged: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('data:changed', listener);
    return () => ipcRenderer.removeListener('data:changed', listener);
  },
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  // critical-reviewer 지적(P12.3 재검증, Medium): onMaximizedChange는 이벤트로만 상태를
  // 받아서 isMaximized 초기값이 항상 false였다 — 창이 이미 최대화된 상태로 마운트/새로고침
  // (dev 모드 Ctrl+R 등)되면 다음 상태 변화 전까지 버튼 아이콘/aria-label이 실제와 어긋났다.
  // 마운트 시 한 번 현재 상태를 직접 물어본다.
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onMaximizedChange: (callback) => {
    const listener = (_event, isMaximized) => callback(isMaximized);
    ipcRenderer.on('window:maximized-changed', listener);
    return () => ipcRenderer.removeListener('window:maximized-changed', listener);
  },
});
