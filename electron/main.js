const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron');
const path = require('path');
const { loadData, saveData } = require('./dataStore');

let mainWindow;
let tray;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 640,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // B5.1: 닫기(X)는 완전 종료가 아니라 트레이로 숨김
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // B5.2: before-quit은 Windows 종료/로그아웃 시 발생하지 않는다(Electron 문서 명시) —
  // session-end로 그 경로를 따로 잡아 close 핸들러가 종료를 막지 않게 한다.
  mainWindow.on('session-end', () => {
    app.isQuitting = true;
  });
}

function createTray() {
  // TODO: 실제 아이콘 리소스로 교체
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('업무 위젯');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '열기/숨기기', click: () => (mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()) },
  ]));
  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
});

// B5.2: 별도 종료 메뉴 없음 — OS 종료/로그아웃 시에만 실제 종료
app.on('before-quit', () => {
  app.isQuitting = true;
});

// window-all-closed 리스너는 인자를 받지 않는다(Electron 타입 정의 확인) — event.preventDefault()는
// 항상 TypeError였다. 창은 X로는 hide만 되고 close되지 않으므로 이 이벤트는 실제 종료 시퀀스에서만
// 발생하며, 그때는 기본 동작(비-macOS에서 앱 종료)을 그대로 둬야 한다. 별도 처리 불필요.

ipcMain.handle('data:load', () => loadData());
ipcMain.handle('data:save', (_event, data) => {
  saveData(data);
  return true;
});
