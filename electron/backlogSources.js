const { ipcMain, dialog } = require('electron');
const { readBacklogSourceFile } = require('./backlogSourceReader');
const { loadData } = require('./dataStore');

// P14.1(사람 결정: 읽기 전용): 등록된 외부 프로젝트의 backlog(.json) 경로에 이 파일 어디도
// 쓰기를 시도하지 않는다 — readBacklogSourceFile(backlogSourceReader.js)이 fs.promises의
// stat/readFile만 쓴다. 그 프로젝트 자신의 CLI/훅 거버넌스(scripts/backlog/lib 같은 검증
// 로직)를 이 위젯이 우회해 건드리는 일이 없도록 하기 위함(P14 summary 참고).
function registerBacklogSourceHandlers(getMainWindow) {
  // 사용자가 직접 긴 경로를 타이핑하지 않도록 네이티브 파일 선택 다이얼로그를 띄운다.
  // 취소하면 null을 돌려주고, 렌더러(BacklogSourceManager.jsx)는 그 경우 아무것도 등록하지 않는다.
  // critical-reviewer 지적(P14.1 리뷰, Low): 창이 없거나 이미 파괴된 상태로 호출되는 경로는
  // 실제로 없지만(렌더러가 살아있어야 이 IPC를 보낼 수 있음), 방어적으로 가드한다.
  ipcMain.handle('backlog-source:pick-file', async () => {
    const win = getMainWindow();
    const parent = win && !win.isDestroyed() ? win : undefined;
    const result = await dialog.showOpenDialog(parent, {
      title: '외부 backlog(.json) 파일 선택',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return result.filePaths[0];
  });

  // critical-reviewer 지적(P14.1 리뷰, Medium): 이 IPC가 렌더러가 보낸 아무 경로나 읽어주면,
  // "경로는 파일 선택 다이얼로그로만 채운다"(B3.5)는 설계 의도가 IPC 계층에서는 강제되지
  // 않는다 — 실제로 등록된(data.json의 backlog_sources에 있는) 경로인지 먼저 확인한다.
  ipcMain.handle('backlog-source:read-tasks', async (_event, filePath) => {
    const data = loadData();
    const isRegistered = data.backlog_sources.some((s) => s && s.path === filePath);
    if (!isRegistered) {
      return { ok: false, error: '등록되지 않은 경로입니다.' };
    }
    return readBacklogSourceFile(filePath);
  });
}

module.exports = { registerBacklogSourceHandlers };
