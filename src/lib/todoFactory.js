// B3.2 스키마를 만족하는 새 Todo 레코드 생성. P2.3(상세화면 인라인 추가)에서 처음 쓰이며,
// 이 앱의 첫 쓰기 경로라 "저장되는 객체가 스키마 10개 필드를 정확히 채우는가"가 자동 검증
// 가능해야 한다(critical-reviewer 지적) — Projects.jsx 안에 인라인으로 두지 않고 여기로 뺀다.
// priority/due_date는 입력폼이 없어 null로 시작 — priority.js의 priorityRank/priorityClassName,
// compareByDueDateThenPriority가 이미 null을 맨 뒤로 안전하게 처리한다.
export function createTodo(projectId, title, now = new Date().toISOString()) {
  return {
    id: `todo-${crypto.randomUUID()}`,
    project_id: projectId,
    title,
    completed: false,
    completed_at: null,
    due_date: null,
    priority: null,
    tags: [],
    created_at: now,
    updated_at: now,
  };
}
