// backlog.json 스키마 검증 + deps 그래프(순환 의존성) 검사.
// gate 필드는 여기서 읽지도, 실행하지도 않는다.
'use strict';

const ID_PATTERN = /^P\d+(\.\d+)*$/; // 기존 관례: P0, P0.1, P1.2 ...

// P27: task별 선택적 목표일(due_date). TaskDock 자신의 date 필드(work-widget-requirements.md
// B3 계약)와 같은 "로컬 타임존 YYYY-MM-DD 문자열" 규약을 그대로 따른다 — 두 프로젝트가 같은
// 사람이 쓰는 도구라 형식이 갈리면 나중에 TaskDock이 이 값을 읽어 캘린더에 놓을 때(P28) 혼란만
// 커진다. 형태(정규식)뿐 아니라 "2026-13-45"처럼 존재하지 않는 날짜도 왕복 검증으로 잡는다
// (TaskDock의 src/lib/dateRange.js가 이미 쓰는 것과 같은 기법 — 다만 이 파일은 CJS/node 전역이라
// 그 ESM 모듈을 그대로 재사용하지 않고 같은 로직만 독립적으로 둔다, eslint.config.js의 src/
// electron/scripts 영역 분리 원칙과 같은 이유).
const DUE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDueDate(value) {
  if (value === null) return true;
  if (typeof value !== 'string' || !DUE_DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

class BacklogError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code; // 'PARSE_ERROR' | 'SCHEMA_ERROR' | 'NOT_FOUND' | 'VALIDATION' | 'CONFLICT' | 'IO_ERROR'
    this.details = details || null;
  }
}

/** 구조 검증. 문제 목록(errors: string[])을 반환한다 — 던지지 않는다. */
function validateSchema(json) {
  const errors = [];
  const statusEnum = Array.isArray(json?.enums?.status) ? json.enums.status : null;
  const priorityEnum = Array.isArray(json?.enums?.priority) ? json.enums.priority : null;
  const categoryEnum = Array.isArray(json?.enums?.category) ? json.enums.category : null;
  const tasks = Array.isArray(json?.tasks) ? json.tasks : null;

  if (!tasks) {
    errors.push('tasks 배열이 없거나 배열이 아닙니다.');
    return errors;
  }

  const ids = new Set();
  for (const t of tasks) {
    if (!t || typeof t !== 'object') { errors.push('tasks 안에 객체가 아닌 항목이 있습니다.'); continue; }
    if (!t.id) { errors.push('id가 없는 task 항목이 있습니다.'); continue; }
    if (ids.has(t.id)) errors.push(`id 중복: "${t.id}"`);
    ids.add(t.id);
    if (statusEnum && !statusEnum.includes(t.status)) {
      errors.push(`"${t.id}".status = ${JSON.stringify(t.status)} 는 enums.status(${statusEnum.join(', ')})에 없는 값입니다.`);
    }
    if (priorityEnum && !priorityEnum.includes(t.priority)) {
      errors.push(`"${t.id}".priority = ${JSON.stringify(t.priority)} 는 enums.priority(${priorityEnum.join(', ')})에 없는 값입니다.`);
    }
    // P27 critical-reviewer 지적(Medium): due_date 형식 검증이 addTask/setField(쓰기 경로)에만
    // 있고 여기(구조 검증, list/show/validate-backlog 훅이 전부 거치는 유일한 관문)엔 없어서,
    // 손 편집이나 다른 도구로 잘못된 값(예: "2026-99-99", true)이 들어와도 훅/조회 명령이
    // 조용히 통과시켰다 — 이미 값이 있는 task는 여기서도 형식을 확인한다(키 자체가 없는 건
    // store.js가 null로 정규화하므로 여기 도달할 때는 항상 키가 있다고 가정하지 않는다 —
    // 'due_date' in t로 먼저 존재 여부를 확인).
    if ('due_date' in t && !isValidDueDate(t.due_date)) {
      errors.push(`"${t.id}".due_date = ${JSON.stringify(t.due_date)} 는 유효한 날짜(YYYY-MM-DD 또는 null)가 아닙니다.`);
    }
    if (categoryEnum && !categoryEnum.includes(t.category)) {
      errors.push(`"${t.id}".category = ${JSON.stringify(t.category)} 는 enums.category(${categoryEnum.join(', ')})에 없는 값입니다.`);
    }
    if (!Array.isArray(t.deps)) {
      errors.push(`"${t.id}".deps 가 배열이 아닙니다.`);
    }
  }
  for (const t of tasks) {
    if (!t || typeof t !== 'object') continue;
    if (Array.isArray(t.deps)) {
      for (const d of t.deps) {
        if (!ids.has(d)) errors.push(`"${t.id}".deps 안의 "${d}" 는 존재하지 않는 task id입니다.`);
      }
    }
    if (t.parent && !ids.has(t.parent)) {
      errors.push(`"${t.id}".parent 가 존재하지 않는 task id "${t.parent}" 를 가리킵니다.`);
    }
  }
  return errors;
}

function assertValid(json) {
  const errors = validateSchema(json);
  if (errors.length) {
    throw new BacklogError('SCHEMA_ERROR', 'backlog.json 스키마 검증 실패', errors);
  }
}

/** deps 그래프에 사이클이 있으면 사이클 경로(string[])를, 없으면 null을 반환. */
function findCycle(tasks) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map(tasks.map((t) => [t.id, WHITE]));
  const stack = [];

  function visit(id) {
    color.set(id, GRAY);
    stack.push(id);
    const t = byId.get(id);
    const deps = (t && Array.isArray(t.deps)) ? t.deps : [];
    for (const d of deps) {
      if (!byId.has(d)) continue; // 참조 무결성은 validateSchema가 별도로 잡는다
      if (color.get(d) === GRAY) {
        return stack.slice(stack.indexOf(d)).concat(d);
      }
      if (color.get(d) === WHITE) {
        const cyc = visit(d);
        if (cyc) return cyc;
      }
    }
    stack.pop();
    color.set(id, BLACK);
    return null;
  }

  for (const t of tasks) {
    if (color.get(t.id) === WHITE) {
      const cyc = visit(t.id);
      if (cyc) return cyc;
    }
  }
  return null;
}

// deps 순환(findCycle)과 별개다 — parent 체인은 deps 배열과 무관한 별도 그래프라 findCycle이
// 이 순환을 잡아주지 않는다(P11 critical-reviewer 지적: mutations.js 주석이 findCycle이
// parent 순환도 막아준다고 잘못 적어놨었음). 참조 무결성(parent가 존재하는 id인지)은
// validateSchema가 이미 확인하므로, 여기서는 "존재하는 id들로만 이뤄진 순환"만 찾는다.
function findParentCycle(tasks) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map(tasks.map((t) => [t.id, WHITE]));

  for (const t of tasks) {
    if (color.get(t.id) !== WHITE) continue;
    const path = [];
    let cursor = t.id;
    while (cursor && byId.has(cursor) && color.get(cursor) !== BLACK) {
      if (color.get(cursor) === GRAY) {
        return path.slice(path.indexOf(cursor)).concat(cursor);
      }
      color.set(cursor, GRAY);
      path.push(cursor);
      cursor = byId.get(cursor).parent;
    }
    for (const id of path) color.set(id, BLACK);
  }
  return null;
}

module.exports = { ID_PATTERN, BacklogError, validateSchema, assertValid, findCycle, findParentCycle, isValidDueDate };
