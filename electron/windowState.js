const fs = require('fs');
const path = require('path');
const { app, screen } = require('electron');

// P7.5 결정(사람, 2026-09-25): 위젯 창 위치/크기를 재시작(로그인 시 자동 실행 포함) 사이에
// 기억한다. data.json과는 별도 파일로 둔다 — dataStore.js의 loadData/saveData 계약(4개 배열,
// 백업/마이그레이션 대상)에 창 위치 같은 UI 상태를 섞으면 그 계약이 흐려진다.
function getWindowStatePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

// P7.4가 정한 최소 크기(420)와 값을 하나로 유지한다 — main.js가 BrowserWindow의
// minWidth/minHeight에도 이 상수를 그대로 쓴다.
const MIN_WINDOW_SIZE = 420;

function isValidBounds(bounds) {
  return (
    bounds &&
    Number.isFinite(bounds.x) &&
    Number.isFinite(bounds.y) &&
    Number.isFinite(bounds.width) &&
    Number.isFinite(bounds.height) &&
    bounds.width > 0 &&
    bounds.height > 0
  );
}

// critical-reviewer가 미리 지적한 위험(P7.4 리뷰): 모니터 구성이 바뀌면(외장 모니터 분리,
// 해상도 변경) 저장된 좌표가 지금은 존재하지 않는 화면 밖을 가리킬 수 있다 — 저장된 창의
// 좌상단(제목 표시줄이 있는 지점, 마우스로 다시 옮기려면 여기가 화면 안에 있어야 함)이 현재
// 연결된 디스플레이 중 하나의 작업 영역 안에 있을 때만 위치를 신뢰한다. critical-reviewer
// 지적(P7.5 리뷰): 처음엔 중심점(center) 기준이었는데, width/height가 비정상적으로 크면
// 중심점 자체가 화면 밖으로 밀려나 clamp가 필요한 경우조차 매칭에 실패했다 — width/height와
// 무관한 좌상단 점만으로 판정하고, 크기는 이후 별도로 clamp한다.
function findContainingDisplay(bounds) {
  return screen.getAllDisplays().find((display) => {
    const { x, y, width, height } = display.workArea;
    return bounds.x >= x && bounds.x < x + width && bounds.y >= y && bounds.y < y + height;
  });
}

// 저장된 값이 없거나, 형식이 깨졌거나, 지금 연결된 화면 밖을 가리키면 null을 돌려준다 —
// 호출부(main.js)가 null이면 기본 위치/크기(420x640, OS가 정하는 기본 위치)로 창을 만든다.
// critical-reviewer 지적(P7.5 리뷰): 크기에 상한이 없으면 손상되거나 손으로 고친 파일이
// 모니터보다 훨씬 큰 창을 만들 수 있었다 — 찾은 화면의 작업 영역 안으로 clamp한다.
function loadWindowState() {
  const filePath = getWindowStatePath();
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null; // 파일이 없으면(최초 실행) 기본값 사용
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null; // 손상된 파일은 조용히 무시 — 창 상태는 다시 저장되면 복구됨
  }
  if (!isValidBounds(parsed)) return null;
  const display = findContainingDisplay(parsed);
  if (!display) return null;
  const { workArea } = display;
  return {
    x: Math.round(parsed.x),
    y: Math.round(parsed.y),
    width: Math.round(Math.min(Math.max(parsed.width, MIN_WINDOW_SIZE), workArea.width)),
    height: Math.round(Math.min(Math.max(parsed.height, MIN_WINDOW_SIZE), workArea.height)),
  };
}

// dataStore.js의 backupIfNeeded와 같은 원칙(atomic write 실패를 조용히 삼키지 않고 로그를
// 남기며, tmp 파일을 정리한다) — critical-reviewer 지적: 이전 버전은 원칙이 같다고 주석에
// 적어놓고 실제로는 로그도 tmp 정리도 없었다.
function saveWindowState(bounds) {
  if (!isValidBounds(bounds)) return;
  const filePath = getWindowStatePath();
  const tmpPath = `${filePath}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(bounds), 'utf-8');
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    console.error('창 상태 저장 실패:', err);
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // tmp 정리 실패는 무시 — 다음 저장 시도 때 덮어써진다
    }
  }
}

module.exports = { loadWindowState, saveWindowState, getWindowStatePath, findContainingDisplay, isValidBounds, MIN_WINDOW_SIZE };
