// 읽기 전용 조회: 목록/필터, 상세, 진행 후보(deps 고려), 전체 id 순회.
'use strict';

const { BacklogError } = require('./schema');

function listTasks(file, filters) {
  filters = filters || {};
  let tasks = file.json.tasks;
  if (filters.status) tasks = tasks.filter((t) => t.status === filters.status);
  if (filters.priority) tasks = tasks.filter((t) => t.priority === filters.priority);
  if (filters.category) tasks = tasks.filter((t) => t.category === filters.category);
  if (filters.parent) tasks = tasks.filter((t) => t.parent === filters.parent);
  return tasks;
}

function getTask(file, id) {
  const t = file.json.tasks.find((x) => x.id === id);
  if (!t) {
    const all = file.json.tasks.map((x) => x.id);
    throw new BacklogError('NOT_FOUND', `id "${id}" 를 찾을 수 없습니다.`, { known_ids_sample: all.slice(0, 10) });
  }
  return t;
}

/** deps가 전부 done인 todo 상태 task = 지금 바로 시작 가능한 후보. */
function readyCandidates(file) {
  const byId = new Map(file.json.tasks.map((t) => [t.id, t]));
  return file.json.tasks.filter((t) => {
    if (t.status !== 'todo') return false;
    const deps = Array.isArray(t.deps) ? t.deps : [];
    return deps.every((d) => byId.get(d)?.status === 'done');
  });
}

function allIds(file) {
  return file.json.tasks.map((t) => t.id);
}

module.exports = { listTasks, getTask, readyCandidates, allIds };
