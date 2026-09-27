// 변경 명령의 실제 규칙: 작업 추가(add), 상태 수정(set-status), 배치 위치 정리(reorder).
// status 이외 메타데이터 필드 교정(set-field, P11)은 eslint max-lines 때문에 fieldMutations.js로
// 분리 — findInsertionIndex를 그쪽에서도 써서 여기서 export한다.
// 전부 store.loadMutateValidateSave를 통해서만 파일에 쓴다(검증 통과 후 원자적 저장).
'use strict';

const { BacklogError, ID_PATTERN, isValidDueDate } = require('./schema');
const { loadMutateValidateSave, nowIso } = require('./store');

// parent가 같은 마지막 형제 task 바로 뒤, 형제가 아직 없으면 parent 자신 바로 뒤에 넣을 위치를 찾는다.
// parent가 없거나 parent를 배열에서 못 찾으면 -1(맨 끝에 push)을 반환한다.
// excludeId: reorder 시 자기 자신을 형제 탐색에서 제외하기 위한 옵션.
function findInsertionIndex(tasks, parentId, excludeId) {
  if (!parentId) return -1;
  let lastSiblingIdx = -1;
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (excludeId && t.id === excludeId) continue;
    if (t.parent === parentId) lastSiblingIdx = i;
  }
  if (lastSiblingIdx !== -1) return lastSiblingIdx;
  return tasks.findIndex((t) => t.id === parentId);
}

function insertTask(tasks, task) {
  const idx = findInsertionIndex(tasks, task.parent, null);
  if (idx === -1) tasks.push(task);
  else tasks.splice(idx + 1, 0, task);
}

// id 관례(P0, P0.1, P1.2 ...)에서 parent를 추론한다: "P1.9" -> "P1", "P1.2.3" -> "P1.2".
// 점이 없는 최상위 id(예: "P9")는 parent가 없다고 본다.
// --parent를 깜빡 안 넘겨도(가장 흔한 실수) id만 보고 올바른 형제 그룹으로 들어가게 하기 위함 —
// 명시적으로 --parent를 넘기면 이 추론보다 그쪽이 항상 우선한다.
function inferParentFromId(id) {
  const lastDot = id.lastIndexOf('.');
  return lastDot === -1 ? null : id.slice(0, lastDot);
}

function addTask(filePath, expectedVersion, input) {
  const required = ['id', 'title', 'status', 'priority', 'category', 'summary', 'done_when'];
  const missing = required.filter((k) => input[k] === undefined || input[k] === null || input[k] === '');
  if (missing.length) {
    throw new BacklogError('VALIDATION', `필수 입력이 없습니다: ${missing.join(', ')}`, { missing });
  }
  if (!ID_PATTERN.test(input.id)) {
    throw new BacklogError('VALIDATION', `id 형식이 기존 관례(P0, P0.1, P1.2 ...)와 다릅니다: "${input.id}"`);
  }
  const deps = Array.isArray(input.deps) ? input.deps : [];
  if (input.status === 'done' && !input.note) {
    throw new BacklogError('VALIDATION', 'status를 done으로 바로 생성하려면 완료 근거(--note)가 필요합니다.');
  }
  // P27: where/doc/gate/parent와 같은 관례 — 빈 문자열이나 리터럴 "null"도 "안 비운다"는 뜻으로
  // 받는다(set-field의 normalizeFieldValue와 동일 규칙, cli.js가 플래그를 그대로 넘기므로 여기서
  // 함께 처리해야 add에서도 일관되게 작동한다).
  const dueDate = input.due_date === '' || input.due_date === 'null' || input.due_date === undefined ? null : input.due_date;
  if (!isValidDueDate(dueDate)) {
    throw new BacklogError('VALIDATION', `due_date 형식이 올바르지 않습니다(YYYY-MM-DD 또는 비움): "${input.due_date}"`);
  }
  // --parent를 명시하면 그 값을, 아니면 id의 점 표기(P1.9 -> P1)에서 자동으로 추론한다.
  const parent = input.parent || inferParentFromId(input.id);

  return loadMutateValidateSave(filePath, expectedVersion, (json) => {
    if (json.tasks.some((t) => t.id === input.id)) {
      throw new BacklogError('VALIDATION', `id "${input.id}" 는 이미 존재합니다.`);
    }
    const statusEnum = json.enums?.status || [];
    const priorityEnum = json.enums?.priority || [];
    const categoryEnum = json.enums?.category || [];
    if (!statusEnum.includes(input.status)) {
      throw new BacklogError('VALIDATION', `status "${input.status}" 는 enums.status(${statusEnum.join(', ')})에 없습니다.`);
    }
    if (!priorityEnum.includes(input.priority)) {
      throw new BacklogError('VALIDATION', `priority "${input.priority}" 는 enums.priority(${priorityEnum.join(', ')})에 없습니다.`);
    }
    if (!categoryEnum.includes(input.category)) {
      throw new BacklogError('VALIDATION', `category "${input.category}" 는 enums.category(${categoryEnum.join(', ')})에 없습니다.`);
    }
    if (parent && !json.tasks.some((t) => t.id === parent)) {
      throw new BacklogError('VALIDATION', `parent "${parent}" 가 존재하지 않습니다${input.parent ? '' : ' (id "' + input.id + '"에서 자동 추론된 값)'}.`);
    }
    for (const d of deps) {
      if (!json.tasks.some((t) => t.id === d)) {
        throw new BacklogError('VALIDATION', `deps의 "${d}" 가 존재하지 않습니다.`);
      }
    }
    const now = nowIso();
    const task = {
      id: input.id,
      status: input.status,
      priority: input.priority,
      category: input.category,
      title: input.title,
      summary: input.summary,
      where: input.where ?? null,
      parent: parent ?? null,
      deps,
      doc: input.doc ?? null,
      done_when: input.done_when,
      due_date: dueDate,
      est_min: input.est_min ?? null,
      gate: input.gate ?? null,
      owner: input.owner ?? null,
      claimed_at: input.claimed_at ?? null,
      updated_at: now,
      log: [],
    };
    if (input.status === 'done') {
      task.log.push({ at: now, owner: input.owner ?? null, status: 'done', note: input.note });
      task.done_at = now.slice(0, 10);
    }
    insertTask(json.tasks, task);
  });
}

// 이미 배열 맨 끝 등 엉뚱한 위치에 들어간 기존 task를 parent 형제 그룹 옆으로 옮긴다.
// status/log/updated_at 등 내용은 건드리지 않고 배열 내 위치만 바꾼다 — 단, 무슨 근거로
// 옮겼는지 추적할 수 있게 log에 한 줄 남긴다(기존 status를 그대로 재사용, 상태 전이 아님).
function reorderTask(filePath, expectedVersion, id, opts) {
  opts = opts || {};
  return loadMutateValidateSave(filePath, expectedVersion, (json) => {
    const idx = json.tasks.findIndex((t) => t.id === id);
    if (idx === -1) {
      throw new BacklogError('NOT_FOUND', `id "${id}" 를 찾을 수 없습니다.`);
    }
    const [task] = json.tasks.splice(idx, 1);
    const insertAt = findInsertionIndex(json.tasks, task.parent, null);
    if (insertAt === -1) json.tasks.push(task);
    else json.tasks.splice(insertAt + 1, 0, task);

    if (opts.note) {
      task.log = Array.isArray(task.log) ? task.log : [];
      task.log.push({ at: nowIso(), owner: opts.owner ?? null, status: task.status, note: opts.note });
    }
  });
}

function setStatus(filePath, expectedVersion, id, newStatus, opts) {
  opts = opts || {};
  return loadMutateValidateSave(filePath, expectedVersion, (json) => {
    const statusEnum = json.enums?.status;
    if (!Array.isArray(statusEnum)) {
      throw new BacklogError('VALIDATION', 'enums.status를 찾을 수 없어 허용 상태를 확인할 수 없습니다. 임의로 진행하지 않습니다.');
    }
    if (!statusEnum.includes(newStatus)) {
      throw new BacklogError('VALIDATION', `status "${newStatus}" 는 enums.status(${statusEnum.join(', ')})에 없습니다.`);
    }
    const task = json.tasks.find((t) => t.id === id);
    if (!task) {
      throw new BacklogError('NOT_FOUND', `id "${id}" 를 찾을 수 없습니다.`);
    }
    if (opts.expectedStatus && task.status !== opts.expectedStatus) {
      throw new BacklogError(
        'CONFLICT',
        `"${id}"의 현재 status는 "${task.status}" 인데 --expected-status="${opts.expectedStatus}" 와 다릅니다.`
      );
    }
    if (newStatus === 'done' && !opts.note) {
      throw new BacklogError(
        'VALIDATION',
        `"${id}"를 done으로 바꾸려면 완료 근거(--note)가 필요합니다. ` +
        `이 작업의 done_when 기준: ${JSON.stringify(task.done_when)}`
      );
    }
    const now = nowIso();
    task.status = newStatus;
    task.updated_at = now;
    // critical-reviewer 지적(P12.8 리뷰): done -> 다른 상태로 되돌릴 때 done_at이 안 지워져서,
    // done_at만 보는 도구/사람이 "완료됐다가 되돌아간" task를 여전히 완료로 오판할 수 있었다.
    if (newStatus === 'done') {
      task.done_at = now.slice(0, 10);
    } else {
      task.done_at = null;
    }
    task.log = Array.isArray(task.log) ? task.log : [];
    task.log.push({ at: now, owner: opts.owner ?? null, status: newStatus, note: opts.note ?? null });
  });
}

module.exports = { addTask, setStatus, reorderTask, findInsertionIndex };
