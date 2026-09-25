const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// P7.2 결정(사람, 2026-09-25): Windows 로그인 자동 실행은 최초 1회만 등록한다 — 매 실행마다
// openAtLogin:true를 강제로 다시 쓰면 사용자가 Windows 설정/작업관리자에서 직접 끈 것까지
// 앱이 되돌려버리는데(요구사항 문서에 이를 정당화할 근거 없음, critical-reviewer 지적), 그건
// 사용자 선택을 무시하는 것이다. userData에 플래그 파일을 남겨 "이미 등록을 시도했다"는
// 사실만 기록하고, 이후 사용자가 껐는지 다시 켰는지는 이 앱이 손대지 않는다.
function getAutoLaunchFlagPath() {
  return path.join(app.getPath('userData'), 'auto-launch-registered.flag');
}

// dataStore.js의 pruneOldBackups와 같은 패턴 — 실제 경로를 인자로 받는 순수 fs 로직이라
// Electron 런타임 없이도(vitest) 검증 가능하다.
function hasRegisteredAutoLaunch(flagPath) {
  return fs.existsSync(flagPath);
}

function markAutoLaunchRegistered(flagPath) {
  fs.writeFileSync(flagPath, new Date().toISOString(), 'utf-8');
}

module.exports = { getAutoLaunchFlagPath, hasRegisteredAutoLaunch, markAutoLaunchRegistered };
