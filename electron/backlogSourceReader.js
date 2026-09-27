const fs = require('fs').promises;

// P14.1: 다른 프로젝트의 backlog(.json)을 등록해 읽기 전용으로 보여주는 기능 — 그 파일들은
// 이 프로젝트의 scripts/backlog/cli.js와 스키마가 같다고 보장할 수 없다(배열 이름, 필드 구성이
// 프로젝트마다 다를 수 있음). 그래서 형식을 하나로 가정하지 않고 관대하게 파싱한다: 흔한 배열
// 위치(최상위 배열, tasks/items/backlog 키) 중 하나라도 있으면 그걸 task 목록으로 보고, 각
// 항목은 id만 있으면 최소한으로 표시하고 title/status/owner는 있으면 쓰고 없으면 자리표시자로
// 채운다(getScheduleCellSummary의 "(제목 없음)"과 같은 방어 패턴).
// critical-reviewer 지적(P14.1 리뷰, Medium): 이 파일이 fs를 직접 안 건드리는 순수 함수였을
// 때는 "인식 불가 형식(빈 목록)"과 "실제로 비어있는 backlog"와 "id 없는 항목이라 전부
// 걸러진 경우"가 화면에서 전부 똑같이 "정상 (task 0개)"로 보여 구분이 안 됐다 — recognized/
// skippedCount를 함께 돌려주도록 반환 형태를 바꾼다.
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

function extractTaskArray(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== 'object') return null;
  if (Array.isArray(parsed.tasks)) return parsed.tasks;
  if (Array.isArray(parsed.items)) return parsed.items;
  if (Array.isArray(parsed.backlog)) return parsed.backlog;
  return null;
}

// P28: 목표일(due_date, P27에서 이 프로젝트 자신의 backlog CLI 스키마에 추가됨)도 있으면 함께
// 읽는다 — 다른 필드(title/status/owner)와 같은 "관대한 파싱" 원칙: 없거나 형식이 이상해도
// 오류 없이 그냥 null로 둔다(이 값이 있는 task만 일정 탭 캘린더에 얹힌다, B3.5 읽기 전용 원칙
// 그대로 — 이 값을 쓰는 쪽도 없다). scripts/backlog/lib/schema.js의 isValidDueDate와 같은
// 로직이지만, 그 파일은 CJS/scripts 전역이라 이 electron 모듈이 직접 재사용하지 않는다
// (eslint.config.js의 src/electron/scripts 영역 분리 원칙과 같은 이유).
function isPlausibleDueDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

function normalizeExternalTask(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.id !== 'string' || !raw.id) return null;
  return {
    id: raw.id,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : '(제목 없음)',
    status: typeof raw.status === 'string' && raw.status.trim() ? raw.status.trim() : '(상태 없음)',
    owner: typeof raw.owner === 'string' && raw.owner.trim() ? raw.owner.trim() : null,
    due_date: isPlausibleDueDate(raw.due_date) ? raw.due_date : null,
  };
}

// critical-reviewer 지적(P14.1 리뷰, Medium): Windows 도구(PowerShell Set-Content -Encoding
// UTF8 등)로 저장된 정상 JSON 파일도 UTF-8 BOM(U+FEFF)이 맨 앞에 붙을 수 있는데, JSON.parse는
// 이걸 안 걷어내고 그대로 예외를 던진다 — 스키마가 다를 수 있는 외부 파일을 관대하게 읽겠다는
// 목적과 맞지 않는 오탐이라 파싱 전에 걷어낸다.
function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

// jsonText가 유효한 JSON이 아니면 JSON.parse가 그대로 던진다 — 호출부(readBacklogSourceFile)가
// try/catch로 그 소스만 오류로 표시하고 나머지 소스/위젯 전체에는 영향이 없게 한다.
function parseBacklogSourceTasks(jsonText) {
  const parsed = JSON.parse(stripBom(jsonText));
  const arr = extractTaskArray(parsed);
  if (!arr) return { tasks: [], recognized: false, skippedCount: 0 };
  const tasks = arr.map(normalizeExternalTask).filter(Boolean);
  return { tasks, recognized: true, skippedCount: arr.length - tasks.length };
}

// critical-reviewer 지적(P14.1 리뷰, Medium): 메인 프로세스에서 동기 fs 호출(existsSync/
// readFileSync)로 등록된(사용자가 고른, 이 프로젝트가 위치를 통제하지 못하는) 외부 경로를
// 읽으면, 큰 파일이나 응답이 느린 네트워크 경로에서 이벤트 루프 전체(트레이·창 제어·다른
// IPC 포함)가 멈출 수 있다 — fs.promises로 비동기 처리하고, 읽기 전에 크기 상한을 먼저
// 검사해 지나치게 큰 파일은 아예 읽지 않는다.
async function readBacklogSourceFile(filePath) {
  if (typeof filePath !== 'string' || !filePath) {
    return { ok: false, error: '경로가 올바르지 않습니다.' };
  }
  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch {
    return { ok: false, error: '파일을 찾을 수 없습니다(이동되었거나 삭제됨).' };
  }
  if (!stat.isFile()) {
    return { ok: false, error: '파일이 아닙니다(폴더가 선택된 것으로 보임).' };
  }
  if (stat.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: `파일이 너무 큽니다(${Math.round(stat.size / (1024 * 1024))}MB, 최대 5MB).` };
  }
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const { tasks, recognized, skippedCount } = parseBacklogSourceTasks(content);
    return { ok: true, tasks, recognized, skippedCount };
  } catch (err) {
    return { ok: false, error: `읽지 못했습니다: ${err && err.message ? err.message : String(err)}` };
  }
}

module.exports = { parseBacklogSourceTasks, readBacklogSourceFile, MAX_FILE_SIZE_BYTES };
