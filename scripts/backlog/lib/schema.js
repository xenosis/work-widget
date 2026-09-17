// backlog.json 스키마 검증 + deps 그래프(순환 의존성) 검사.
// gate 필드는 여기서 읽지도, 실행하지도 않는다.
'use strict';

const ID_PATTERN = /^P\d+(\.\d+)*$/; // 기존 관례: P0, P0.1, P1.2 ...

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

module.exports = { ID_PATTERN, BacklogError, validateSchema, assertValid, findCycle };
