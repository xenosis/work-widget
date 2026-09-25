import { deriveProjectStatus } from './projectStatus.js';

// P3.2: 완료 체크 토글. completed_at은 B3.2 스키마대로 완료 시각을 기록하고, 완료 취소 시 null로
// 되돌린다(다시 체크하면 그 시점의 새 시각이 들어감 — "언제 완료했었는지"는 보존하지 않기로 함,
// 요구사항에 이력 보존 규정이 없음).
export function applyTodoCompletion(todos, todoId, completed, now = new Date().toISOString()) {
  return (Array.isArray(todos) ? todos : []).map((t) =>
    t && t.id === todoId ? { ...t, completed, completed_at: completed ? now : null, updated_at: now } : t
  );
}

// B4.3: 할일 완료를 체크/해제하거나 새 할일을 추가하면 소속 프로젝트 상태도 함께 재계산한다 —
// Projects.jsx(handleAddTodo, P2.3)와 Todos.jsx(handleToggleComplete, P3.2) 양쪽이 이 함수
// 하나를 공유한다(따로 들고 있으면 한쪽만 고쳤을 때 조용히 갈라진다 — priority.js/dateRange.js와
// 같은 이유). status가 실제로 바뀔 때만 updated_at을 갱신한다 — projectMutations.js의
// applyProjectUpdate와 같은 계약(B3.1: updated_at=수정일, 안 바뀐 필드까지 시각을 앞당기지
// 않음). project_id가 없는 할일(B3.2상 원래는 항상 있어야 하는 값이 빠진 예외 데이터)이면
// 상태 전환 판단 자체를 건너뛴다.
export function applyProjectStatusForTodos(projects, projectId, todos, now = new Date().toISOString()) {
  const list = Array.isArray(projects) ? projects : [];
  if (!projectId) return list;
  return list.map((p) => {
    if (!p || p.id !== projectId) return p;
    const nextStatus = deriveProjectStatus(p.status, projectId, todos);
    return nextStatus === p.status ? p : { ...p, status: nextStatus, updated_at: now };
  });
}

// P3.5: 제목/마감일/우선순위/태그/소속 프로젝트 수정. completed/completed_at은 이 함수의
// 책임이 아니다 — 그건 P3.2의 applyTodoCompletion 전용 경로로 남겨(같은 값을 두 경로가 다른
// updated_at으로 건드리면 "마지막에 저장한 쪽이 이긴다"는 혼란만 생김).
export function applyTodoUpdate(todos, todoId, updates, now = new Date().toISOString()) {
  return (Array.isArray(todos) ? todos : []).map((t) =>
    t && t.id === todoId ? { ...t, ...updates, updated_at: now } : t
  );
}

export function removeTodo(todos, todoId) {
  return (Array.isArray(todos) ? todos : []).filter((t) => !(t && t.id === todoId));
}
