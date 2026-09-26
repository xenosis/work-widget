const { ipcMain } = require('electron');

// P12.22: electron/main.js가 300줄 한도(eslint max-lines)에 근접해(P12.3 이후 299줄) 창
// 제어(최소화/최대화/닫기/상태조회) IPC 핸들러 4개를 이 파일로 옮긴다. mainWindow는 main.js
// 안에서 재할당되는 let 변수라 이 모듈이 참조를 직접 들고 있을 수 없다 — getMainWindow()로
// 항상 최신 참조를 가져온다. 닫기는 win.close()만 호출하고 실제로 트레이로 숨길지(B5.1)는
// main.js에 이미 등록된 'close' 이벤트 핸들러가 그대로 판단한다(로직 이원화 방지, P12.3과
// 같은 원칙).
function registerWindowControls(getMainWindow) {
  ipcMain.on('window:minimize', () => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) win.minimize();
  });
  ipcMain.on('window:toggle-maximize', () => {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.on('window:close', () => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) win.close();
  });
  ipcMain.handle('window:is-maximized', () => {
    const win = getMainWindow();
    return Boolean(win && !win.isDestroyed() && win.isMaximized());
  });
}

// P12.3: TitleBar.jsx의 최대화/복원 버튼 아이콘을 실제 창 상태와 맞추려면 렌더러가 현재
// 최대화 여부를 알아야 한다 — 버튼 클릭 시점 값만으로는 다른 경로(더블클릭 드래그 영역,
// Windows의 화면 위쪽 드래그 스냅 등)로 상태가 바뀌는 걸 못 따라가므로, 상태가 실제로 바뀔
// 때마다 이벤트로 알린다.
function forwardMaximizeState(win) {
  win.on('maximize', () => {
    if (!win.webContents.isDestroyed()) win.webContents.send('window:maximized-changed', true);
  });
  win.on('unmaximize', () => {
    if (!win.webContents.isDestroyed()) win.webContents.send('window:maximized-changed', false);
  });
}

module.exports = { registerWindowControls, forwardMaximizeState };
