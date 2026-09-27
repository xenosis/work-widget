// P11: set-field 명령 전용 로직. mutations.js에서 분리한 이유는 eslint max-lines(300) —
// add/set-status/reorder(기존 명령)와 별개 파일로 둬야 mutations.js가 한도를 넘지 않는다.
'use strict';

const { BacklogError, isValidDueDate } = require('./schema');
const { loadMutateValidateSave, nowIso } = require('./store');
const { findInsertionIndex } = require('./mutations');

// P11: status/log/id/updated_at/done_at/claimed_at 이외의 메타데이터(오래돼 틀린 summary,
// 잘못 추론된 deps/parent 등)를 고칠 방법이 없어 사람이 매번 "손으로 backlog.json을 고쳐도
// 되냐"는 질문을 반복했다(P0.6/P1.7/P7.1/P1.1/P2.1/P3.1 사례) — 그 결정(사람, 2026-09-25:
// "도입한다")에 따라 만든 명령. status는 set-status의 영역이라 여기서 제외하고, id/log는
// 무결성·이력 보존을 위해 절대 직접 못 고치게 막는다.
const EDITABLE_FIELDS = [
  'title', 'summary', 'where', 'doc', 'done_when',
  'est_min', 'gate', 'priority', 'category', 'parent', 'deps', 'due_date',
];

// P11 critical-reviewer 지적(High): CLI는 값 없이 "--field"만 넘기면 flags[field]=true(boolean)를
// 준다 — 이걸 걸러내지 않으면 title/summary/done_when은 String(true)='true'라 빈값 검사를
// 통과해버리고, gate/where/doc는 그대로 true가 저장되고, est_min은 Number(true)=1이 된다.
// deps만 예외로 배열(프로그램 호출 시)도 허용한다.
function assertFieldValueType(field, rawValue) {
  if (field === 'deps') {
    if (typeof rawValue !== 'string' && !Array.isArray(rawValue)) {
      throw new BacklogError('VALIDATION', 'deps 값은 문자열(콤마 구분) 또는 배열이어야 합니다.');
    }
    return;
  }
  if (typeof rawValue !== 'string') {
    throw new BacklogError(
      'VALIDATION',
      `"${field}" 값은 문자열이어야 합니다 (--${field}=값 형태로 넘기세요 — --${field}만 넘기면 boolean이 되어 거부됩니다).`
    );
  }
}

function normalizeFieldValue(field, rawValue) {
  if (field === 'deps') {
    const arr = Array.isArray(rawValue)
      ? rawValue
      : String(rawValue).split(',').map((s) => s.trim()).filter(Boolean);
    return [...new Set(arr)]; // P11 critical-reviewer 지적(Medium): 중복 deps 제거
  }
  if (field === 'est_min') {
    if (rawValue === '') return null;
    const n = Number(rawValue);
    // P11 critical-reviewer 지적(High): 예전엔 Number(NaN)이 JSON.stringify를 거치며
    // 조용히 null로 바뀌어(음수/비정상 값도 그대로 통과) 감사 로그(field_edit.after)가
    // 잘못된 값을 "정상 반영"인 것처럼 남겼다 — 여기서 바로 거부한다.
    if (!Number.isFinite(n) || n < 0) {
      throw new BacklogError('VALIDATION', `est_min은 0 이상의 숫자여야 합니다: "${rawValue}"`);
    }
    return n;
  }
  // P11 critical-reviewer 지적(Medium): add의 --priority=null 관례와 맞춰 빈 문자열뿐 아니라
  // 리터럴 "null" 문자열도 비우는 값으로 받는다.
  if (field === 'where' || field === 'doc' || field === 'gate' || field === 'parent' || field === 'due_date') {
    return rawValue === '' || rawValue === 'null' || rawValue === undefined ? null : rawValue;
  }
  return rawValue;
}

// deps/set-status와 달리 이 명령은 구조를 직접 건드릴 수 있는 필드(parent, deps)를 받으므로
// addTask와 같은 존재성 검증에 더해, parent 변경이 새 순환을 만드는지도 여기서 먼저 사람이
// 읽을 수 있는, 이 필드 하나만 콕 집은 오류로 잡는다. 주의(P11 critical-reviewer 지적,
// Critical): 이건 유일한 방어선이 아니지만 "다른 어딘가가 결국 막아준다"도 아니다 —
// findCycle(schema.js)은 deps 그래프만 보고 parent는 전혀 보지 않는다. parent 순환에 대한
// 진짜 최종 방어선은 store.js의 findParentCycle이며, 여기서는 더 읽기 좋은 메시지를 먼저
// 주는 역할만 한다.
function assertNoParentCycle(tasks, id, newParent) {
  let cursor = newParent;
  const seen = new Set();
  while (cursor) {
    if (cursor === id) {
      throw new BacklogError('VALIDATION', `parent를 "${newParent}"로 바꾸면 "${id}"가 자기 자신의 하위가 되는 순환이 생깁니다.`);
    }
    if (seen.has(cursor)) return; // 기존 데이터에 이미 있는(이 변경과 무관한) 순환 — store.js의 findParentCycle이 최종적으로 잡는다
    seen.add(cursor);
    const parentTask = tasks.find((t) => t.id === cursor);
    cursor = parentTask ? parentTask.parent : null;
  }
}

function setField(filePath, expectedVersion, id, updates, opts) {
  opts = opts || {};
  const fields = Object.keys(updates);
  if (fields.length === 0) {
    throw new BacklogError('VALIDATION', '고칠 필드를 최소 하나는 지정하세요 (예: --where=..., --deps=a,b).');
  }
  const unknown = fields.filter((f) => !EDITABLE_FIELDS.includes(f));
  if (unknown.length) {
    throw new BacklogError(
      'VALIDATION',
      `set-field로 고칠 수 없는 필드입니다: ${unknown.join(', ')}. 허용 필드: ${EDITABLE_FIELDS.join(', ')} ` +
      `(status는 set-status를 쓰세요. id/log/updated_at/done_at/claimed_at은 직접 못 고칩니다.)`
    );
  }
  // P11 critical-reviewer 지적(Medium): --note만 넘기면(값 없음) true가 되어 필수 검사를
  // 통과해버려 감사 근거가 비게 된다 — 문자열인지까지 확인한다.
  if (typeof opts.note !== 'string' || !opts.note.trim()) {
    throw new BacklogError('VALIDATION', `"${id}"의 필드를 고치려면 근거(--note)가 필요합니다.`);
  }
  for (const field of fields) {
    assertFieldValueType(field, updates[field]);
  }
  for (const key of ['title', 'summary', 'done_when']) {
    if (updates[key] !== undefined && String(updates[key]).trim() === '') {
      throw new BacklogError('VALIDATION', `"${key}"는 빈 값으로 바꿀 수 없습니다.`);
    }
  }

  return loadMutateValidateSave(filePath, expectedVersion, (json) => {
    const task = json.tasks.find((t) => t.id === id);
    if (!task) {
      throw new BacklogError('NOT_FOUND', `id "${id}" 를 찾을 수 없습니다.`);
    }
    const priorityEnum = json.enums?.priority || [];
    const categoryEnum = json.enums?.category || [];
    if (updates.priority !== undefined && !priorityEnum.includes(updates.priority)) {
      throw new BacklogError('VALIDATION', `priority "${updates.priority}" 는 enums.priority(${priorityEnum.join(', ')})에 없습니다.`);
    }
    if (updates.category !== undefined && !categoryEnum.includes(updates.category)) {
      throw new BacklogError('VALIDATION', `category "${updates.category}" 는 enums.category(${categoryEnum.join(', ')})에 없습니다.`);
    }
    if (updates.due_date !== undefined) {
      const nextDueDate = normalizeFieldValue('due_date', updates.due_date);
      if (!isValidDueDate(nextDueDate)) {
        throw new BacklogError('VALIDATION', `due_date 형식이 올바르지 않습니다(YYYY-MM-DD 또는 비움): "${updates.due_date}"`);
      }
    }
    if (updates.parent !== undefined) {
      const newParent = normalizeFieldValue('parent', updates.parent);
      if (newParent !== null) {
        if (newParent === id) {
          throw new BacklogError('VALIDATION', `parent는 자기 자신("${id}")일 수 없습니다.`);
        }
        if (!json.tasks.some((t) => t.id === newParent)) {
          throw new BacklogError('VALIDATION', `parent "${newParent}" 가 존재하지 않습니다.`);
        }
        assertNoParentCycle(json.tasks, id, newParent);
      }
    }
    if (updates.deps !== undefined) {
      const depsArr = normalizeFieldValue('deps', updates.deps);
      for (const d of depsArr) {
        if (d === id) {
          throw new BacklogError('VALIDATION', `deps에 자기 자신("${id}")을 넣을 수 없습니다.`);
        }
        if (!json.tasks.some((t) => t.id === d)) {
          throw new BacklogError('VALIDATION', `deps의 "${d}" 가 존재하지 않습니다.`);
        }
      }
    }

    const before = {};
    const after = {};
    for (const field of fields) {
      const nextValue = normalizeFieldValue(field, updates[field]);
      before[field] = task[field] ?? null;
      task[field] = nextValue;
      after[field] = nextValue;
    }
    const now = nowIso();
    task.updated_at = now;
    task.log = Array.isArray(task.log) ? task.log : [];
    // status는 그대로 두고(필드 수정은 상태 전이가 아님) 무엇을 왜 고쳤는지만 남긴다.
    task.log.push({ at: now, owner: opts.owner ?? null, status: task.status, note: opts.note, field_edit: { before, after } });

    // P11 critical-reviewer 지적(Medium): parent만 고치고 배열 내 위치는 그대로 두면 그
    // task가 새 부모의 형제 그룹과 동떨어진 자리에 남는다 — add/reorder와 같은 규칙으로
    // 새 parent의 마지막 형제 바로 뒤로 옮긴다.
    if (fields.includes('parent')) {
      const idx = json.tasks.findIndex((t) => t.id === id);
      const [movedTask] = json.tasks.splice(idx, 1);
      const insertAt = findInsertionIndex(json.tasks, movedTask.parent, null);
      if (insertAt === -1) json.tasks.push(movedTask);
      else json.tasks.splice(insertAt + 1, 0, movedTask);
    }
  });
}

module.exports = { setField, EDITABLE_FIELDS };
