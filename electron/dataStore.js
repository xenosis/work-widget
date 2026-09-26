const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// B3: projects / todos / memos / schedules / schedule_categories(P12.16 추가) /
// backlog_sources(P14.1 추가) 6개 배열을 담은 단일 JSON 파일
// 계약: Todo/Project/Schedule의 date 필드(due_date, date 등)는 로컬 타임존 기준 "YYYY-MM-DD" 문자열로
// 저장한다(다른 형식 없음). 화면 쪽(예: src/screens/Dashboard.jsx)이 이 값을 문자열 완전일치(===)로
// "오늘"과 비교하므로, 이 형식이 깨지면 그 비교가 조용히 실패한다.
// P12.16: 일정 카테고리(분류) 배열을 새 최상위 키로 추가한다 — 기존 4개 배열과 같은 방식으로
// 정규화(누락 시 빈 배열, 항목마다 FIELD_DEFAULTS 적용)돼야 하므로 여기 포함시킨다.
// P14.1: 등록된 외부 프로젝트 backlog(.json) 경로 목록(backlog_sources)도 같은 방식으로
// 정규화한다 — 이 배열 자체는 이 위젯의 data.json에 저장되는 "등록 정보"일 뿐, 가리키는
// 대상 파일(다른 프로젝트의 backlog(.json))은 이 정규화와 무관하게 읽기 전용으로만 다룬다.
const ARRAY_KEYS = ['projects', 'todos', 'memos', 'schedules', 'schedule_categories', 'backlog_sources'];

function getDataPath() {
  return path.join(app.getPath('userData'), 'data.json');
}

// P13(2026-09-26, critical-reviewer 지적, Critical): 앱 이름이 "업무 위젯"→"TaskDock"으로
// 바뀌면서 Electron의 userData 경로(`app.getPath('userData')`, 기본적으로 `%APPDATA%\<앱
// 이름>`)도 자동으로 따라 바뀐다 — 이름만 바꿨을 뿐인데 사용자 눈에는 기존 프로젝트/할일/메모/
// 일정이 전부 사라진 것처럼 보이는 문제였다(실제로는 옛 폴더에 그대로 남아있을 뿐). 새 폴더에
// 아직 data.json이 없고 옛 폴더에는 있으면 그 폴더 전체(백업/window-state/자동실행 플래그
// 포함)를 한 번만 그대로 복사한다. 새 폴더에 이미 data.json이 있으면(이미 마이그레이션했거나
// 애초에 신규 설치) 아무것도 하지 않아 매 실행마다 다시 덮어쓰지 않는다. 옛 폴더 자체를
// 지우지는 않는다(복사 실패/부분 실패 시에도 원본이 안전하게 남아있도록 — 실패해도 다음 실행
// 때 다시 시도할 수 있다).
// 실사용 중 발견한 버그(2026-09-27): Electron의 userData 폴더 이름은 `productName`이 아니라
// package.json의 `name` 필드(`app.name`의 기본값)를 따른다 — 처음엔 옛 `productName`("업무
// 위젯")을 옛 폴더 이름으로 잘못 가정해서, 실제 옛 폴더("work-widget", 옛 `name` 필드 값)를
// 못 찾아 마이그레이션이 조용히 아무 일도 안 하고 지나갔다(실제 사용자 데이터로 확인). 후보
// 두 개를 순서대로 확인하도록 고친다 — 실제 원인인 "work-widget"을 먼저 보되, 혹시 모를
// 다른 환경(예: productName 기준으로 resolve되는 경우)도 방어적으로 포함한다.
const LEGACY_USER_DATA_DIR_NAMES = ['work-widget', '업무 위젯'];

function migrateLegacyUserData() {
  const currentDir = app.getPath('userData');
  if (fs.existsSync(path.join(currentDir, 'data.json'))) return;
  const parentDir = path.dirname(currentDir);
  for (const legacyName of LEGACY_USER_DATA_DIR_NAMES) {
    const legacyDir = path.join(parentDir, legacyName);
    if (!fs.existsSync(path.join(legacyDir, 'data.json'))) continue;
    fs.mkdirSync(currentDir, { recursive: true });
    fs.cpSync(legacyDir, currentDir, { recursive: true });
    return;
  }
}

const BACKUP_DIR_NAME = 'backups';
// B5.3: "정확한 주기·보관 개수는 구현 시 조정 가능"이라고 명시돼 있어 하루 1회·최근 7개로 정한다.
// critical-reviewer 지적: "최근 7일치"가 아니라 정확히는 "형식이 맞는 파일 최근 7개"다 —
// 미래 날짜 파일이나 사람이 손댄 파일이 섞이면 날짜와 개수가 어긋날 수 있어 이렇게 부른다.
const BACKUP_RETENTION_COUNT = 7;

function getBackupDir() {
  return path.join(app.getPath('userData'), BACKUP_DIR_NAME);
}

function todayDateStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 오래된 백업을 최근 retentionCount개만 남기고 정리한다 — 파일명이 "data-YYYY-MM-DD.json" 형식이라
// 문자열 정렬이 곧 날짜순 정렬이다. critical-reviewer 지적: 시계가 앞으로 틀어졌던 적이 있어
// 미래 날짜 파일이 섞이면 그게 항상 "최신"으로 정렬돼 방금 만든 오늘자 백업이 오히려 개수 밀림으로
// 삭제될 수 있었다 — protectedName(오늘자 파일명)은 삭제 후보에서 항상 제외한다.
function pruneOldBackups(dir, protectedName, retentionCount = BACKUP_RETENTION_COUNT) {
  let files;
  try {
    files = fs
      .readdirSync(dir)
      .filter((f) => /^data-\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .sort();
  } catch {
    return;
  }
  const excess = files.length - retentionCount;
  if (excess <= 0) return;
  let removed = 0;
  for (const file of files) {
    if (removed >= excess) break;
    if (file === protectedName) continue;
    try {
      fs.unlinkSync(path.join(dir, file));
      removed += 1;
    } catch (err) {
      console.error('오래된 백업 정리 실패:', file, err);
    }
  }
}

// B5.3 자동 백업. 렌더러가 데이터를 불러올 때마다(마운트 시 + 트레이 재표시 시마다,
// useAppData.js의 onDataChanged 패턴) loadData()가 호출되지만, 오늘 날짜 백업이 이미 있으면
// 곧바로 리턴하므로 실제로는 하루에 한 번만 파일을 복사한다. saveData 끝에서도 이 함수를
// 불러(existsSync 한 번뿐이라 비용이 거의 없음) 한 화면만 며칠째 띄워둔 채 편집만 하는(트레이
// 재표시/탭 전환이 아예 없는) 드문 경우에도 그날의 첫 저장 시점에 백업이 생기게 한다 —
// critical-reviewer 지적: loadData에만 있으면 이 경로가 done_when의 "주기적으로"를 못 지킨다.
// atomicWriteJson과 같은 이유로 tmp 파일에 복사한 뒤 rename한다 — 복사 도중 실패해도 잘린
// 파일이 최종 이름으로 남아 그날의 백업 재시도를 영구히 막는 일이 없게 한다.
function backupIfNeeded(filePath) {
  const dir = getBackupDir();
  const backupName = `data-${todayDateStamp()}.json`;
  const backupPath = path.join(dir, backupName);
  if (fs.existsSync(backupPath)) return; // 오늘 이미 백업함
  const tmpPath = `${backupPath}.tmp-${process.pid}`;
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(filePath, tmpPath);
    fs.renameSync(tmpPath, backupPath);
    pruneOldBackups(dir, backupName);
  } catch (err) {
    console.error('데이터 백업 실패:', err);
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // tmp 정리 실패는 무시 — 다음 백업 시도 때 덮어써진다
    }
  }
}

// P6.4: 구버전 레코드에 B3 스키마가 나중에 추가한 필드가 없으면(undefined) 기본값으로 채운다.
// 범위는 "누락된 필드 채우기"로 한정한다 — 이미 값이 있지만 타입이 잘못된 경우(예: title이
// 객체, is_recurring이 문자열 "false")까지 고치는 건 하지 않는다. 그런 임의 손상 방어는 각
// 화면이 이미 부분적으로 갖춘 패턴(Array.isArray 가드, id 없는 레코드 제외 등)에 맡기고,
// 여기서는 명시적으로 다루지 않는다 — is_recurring 등 boolean 필드의 타입 불일치(화면마다
// truthy 판정과 === true 판정이 섞여 있음)는 critical-reviewer 지적으로 P6.6에 별도 등록했다.
// B3가 non-nullable로 규정하지만(type/priority/date/created_at/updated_at) 안전한 "빈" 기본값이
// 없는 필드는 null로 둔다 — "필드 없음"과 "null"을 이미 동일하게 취급하는 기존 소비 코드
// 기준으로는 회귀가 아니지만, 엄밀히는 스펙이 정하지 않은 해석이다(work-widget-requirements.md
// B3 결정 문단 참고).
// 이 정규화는 loadData() 호출 시 메모리에서만 적용된다 — 화면들이 저장할 때 loadData가 돌려준
// 전체 객체를 그대로 spread해서 saveData로 보내므로(예: Todos.jsx), 어느 화면에서든 저장이
// 한 번 일어나면 편집 대상이 아니었던 나머지 레코드들의 기본값도 함께 디스크에 반영된다.
const FIELD_DEFAULTS = {
  projects: { name: '', type: null, status: '진행중', description: null, due_date: null, created_at: null, updated_at: null },
  todos: {
    project_id: null,
    title: '',
    completed: false,
    completed_at: null,
    due_date: null,
    priority: null,
    tags: [],
    created_at: null,
    updated_at: null,
  },
  memos: { project_id: null, title: '', content: '', created_at: null, updated_at: null },
  // P12.16: category_id(nullable) 추가 — 기존 일정(카테고리 개념이 없던 시절 데이터)도
  // null로 채워져 "미분류"로 정상 로드된다. 실제로 카테고리를 고르는 UI는 P12.17의 몫이라
  // 이 시점엔 항상 null로만 채워지지만, 스키마 자체는 지금 확정해 둔다.
  schedules: {
    title: '',
    date: null,
    is_recurring: false,
    recurrence_days: null,
    category_id: null,
    created_at: null,
    updated_at: null,
  },
  // P12.16: color는 src/lib/categoryPalette.js가 정의한 고정 팔레트 키(문자열, 예: 'blue') —
  // 자유 색상이 아니라 palette.js가 팔레트를 바꾸면 전체가 함께 갱신되는 간접 참조다.
  // critical-reviewer 지적(재검증 2라운드, Medium): 다른 4개 엔티티는 전부 created_at/
  // updated_at을 기본값에 넣는데 이 엔티티만 빠져 있었다 — P6.4 패턴과 통일.
  schedule_categories: { name: '', color: 'gray', created_at: null, updated_at: null },
  // P14.1: path는 등록 시 항상 채워지지만(파일 선택 다이얼로그를 거쳐야만 생성됨), 다른
  // 필드와 마찬가지로 방어적으로 기본값을 둔다 — label은 비어 있으면 화면에서 path가 위치한
  // 폴더 이름(대개 프로젝트 폴더명)으로 대체 표시한다(backlogSourceMutations.js의
  // getSourceDisplayLabel/deriveLabelFromPath 참고, critical-reviewer 지적으로 문구 정정:
  // "파일명"이 아니라 "폴더명"이다 — 파일명 자체는 대개 backlog.json으로 다 똑같아서).
  // P17: 그 소스를 "이번 주 들어 처음 확인한 시점"의 task 상태를 이번 주 변화 감지 기준선으로
  // 저장한다({ weekStart, tasks }) — src/lib/backlogWeeklySnapshot.js가 주 경계를 넘으면 자동
  // 갱신한다. 새로 등록된 소스는 아직 한 번도 확인 안 했으므로 null(첫 확인 시 즉시 채워짐).
  backlog_sources: { path: null, label: null, weekly_snapshot: null, created_at: null, updated_at: null },
};

// critical-reviewer 지적: FIELD_DEFAULTS의 배열 기본값(tags)이 레코드마다 같은 인스턴스를
// 공유하면, 한 레코드의 배열을 제자리에서 바꿀 때(push 등) 다른 레코드까지 영향받을 수 있다 —
// 이 렌더러는 불변 갱신만 쓰지만(critical-reviewer도 확인), 방어적으로 매번 새 배열을 만든다.
function cloneDefaultValue(value) {
  return Array.isArray(value) ? [...value] : value;
}

function applyFieldDefaults(entityKey, record) {
  const defaults = FIELD_DEFAULTS[entityKey];
  const result = { ...record };
  for (const field of Object.keys(defaults)) {
    if (result[field] === undefined) {
      result[field] = cloneDefaultValue(defaults[field]);
    }
  }
  return result;
}

// 필드 누락/타입 불일치 방어(P6.3): ARRAY_KEYS의 키가 없거나 배열이 아니면 빈 배열로 보정하고,
// 배열 안에 객체가 아닌 항목은 제거한다. 향후 스키마가 늘어나도 이 함수만 확장하면 된다.
function normalizeData(data) {
  const result = {};
  for (const key of ARRAY_KEYS) {
    const value = data && data[key];
    const items = Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
    result[key] = items.map((item) => applyFieldDefaults(key, item));
  }
  return result;
}

// 파싱 자체가 실패하거나 구조가 완전히 다른 파일은 덮어쓰기 전에 원본을 보존한다 —
// 그냥 기본값으로 넘어가면 다음 saveData()에서 원본이 영구히 사라지기 때문.
function backupCorruptFile(filePath, rawText) {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.writeFileSync(`${filePath}.corrupt-${stamp}`, rawText, 'utf-8');
  } catch {
    // 백업 실패가 앱 기동 자체를 막으면 안 되므로 조용히 기본값으로 계속 진행한다
  }
}

// 임시 파일 작성 후 rename — 쓰는 도중 강제 종료돼도 원본이 반쯤 쓰인 채로 깨지지 않는다
// (같은 볼륨 내 rename은 원자적).
function atomicWriteJson(filePath, obj) {
  const tmpPath = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tmpPath, JSON.stringify(obj, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function loadData() {
  const filePath = getDataPath();
  if (!fs.existsSync(filePath)) {
    const fresh = normalizeData({});
    try {
      atomicWriteJson(filePath, fresh);
    } catch {
      // 최초 파일 생성이 실패해도(권한 등) 이번 세션은 기본값으로 계속 진행 — 다음 saveData에서 재시도된다
    }
    return fresh;
  }

  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return normalizeData({}); // 읽기 자체 실패(권한 등) — 원본은 건드리지 않고 기본값으로 계속 진행
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    backupCorruptFile(filePath, raw);
    return normalizeData({});
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    backupCorruptFile(filePath, raw);
    return normalizeData({});
  }
  // critical-reviewer 지적: 파싱 성공(=복구 가치가 있는 상태) 확인 전에 백업하면 손상된 파일이
  // 그대로 정상 백업 칸을 차지해 더 오래된 멀쩡한 백업을 밀어낸다 — 파싱을 통과한 뒤에만 백업한다.
  backupIfNeeded(filePath);
  return normalizeData(parsed);
}

// saveData는 loadData가 돌려준 전체 객체를 그대로 다시 받는다는 계약이다(부분 객체 저장 금지).
// 여기서 누락된 키를 normalizeData로 [] 채워버리면 실수로 일부 필드만 보낸 호출이 나머지
// 엔티티를 조용히 통째로 지워버린다 — 그래서 채우지 않고 명시적으로 거부한다.
// 미확인 최상위 키(예: 향후 버전 필드)도 여기선 손대지 않고 그대로 저장한다.
function saveData(data) {
  for (const key of ARRAY_KEYS) {
    if (!Array.isArray(data && data[key])) {
      throw new Error(
        `saveData: "${key}" 필드가 배열이 아닙니다. loadData()로 받은 전체 객체를 수정해서 그대로 저장하세요(부분 객체 저장 금지).`
      );
    }
  }
  const filePath = getDataPath();
  atomicWriteJson(filePath, data);
  // 이 화면만 며칠째 띄워둔 채 편집만 하는 경우(트레이 재표시/탭 전환이 없어 loadData가 다시
  // 안 불리는 경우)에도 그날의 첫 저장에서 백업이 생기게 한다 — loadData 쪽 backupIfNeeded와
  // 동일 함수라 오늘 이미 백업했으면 곧바로 리턴한다(existsSync 한 번, 비용 무시할 만함).
  backupIfNeeded(filePath);
}

module.exports = {
  loadData,
  saveData,
  getDataPath,
  normalizeData,
  pruneOldBackups,
  backupIfNeeded,
  todayDateStamp,
  migrateLegacyUserData,
};
