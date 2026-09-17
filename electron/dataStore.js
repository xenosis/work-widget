const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// B3: projects / todos / memos / schedules 4개 배열을 담은 단일 JSON 파일
// 계약: Todo/Project/Schedule의 date 필드(due_date, date 등)는 로컬 타임존 기준 "YYYY-MM-DD" 문자열로
// 저장한다(다른 형식 없음). 화면 쪽(예: src/screens/Dashboard.jsx)이 이 값을 문자열 완전일치(===)로
// "오늘"과 비교하므로, 이 형식이 깨지면 그 비교가 조용히 실패한다.
const ARRAY_KEYS = ['projects', 'todos', 'memos', 'schedules'];

function getDataPath() {
  return path.join(app.getPath('userData'), 'data.json');
}

// 필드 누락/타입 불일치 방어(P6.3): 4개 키가 없거나 배열이 아니면 빈 배열로 보정하고,
// 배열 안에 객체가 아닌 항목은 제거한다. 향후 스키마가 늘어나도 이 함수만 확장하면 된다.
function normalizeData(data) {
  const result = {};
  for (const key of ARRAY_KEYS) {
    const value = data && data[key];
    result[key] = Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
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
  atomicWriteJson(getDataPath(), data);
}

module.exports = { loadData, saveData, getDataPath, normalizeData };
