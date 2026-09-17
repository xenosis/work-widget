// Project.progress 계산 (B3.1) — 저장하지 않고 조회 시 소속 todo 완료 비율로 계산한다.
// 소속 todo가 하나도 없는 프로젝트는 "아직 시작 전"으로 보고 0%로 취급한다.

export function calculateProjectProgress(projectId, todos) {
  if (!Array.isArray(todos)) return 0;
  const owned = todos.filter((t) => t && t.project_id === projectId);
  if (owned.length === 0) return 0;
  const completed = owned.filter((t) => t.completed === true).length;
  return Math.round((completed / owned.length) * 100);
}
