// Project.progress 계산 (B3.1) — 저장하지 않고 조회 시 소속 todo 완료 비율로 계산한다.
// 소속 todo가 하나도 없는 프로젝트는 "아직 시작 전"으로 보고 0%로 취급한다.

export function calculateProjectProgress(projectId, todos) {
  if (!Array.isArray(todos)) return 0;
  const owned = todos.filter((t) => t && t.project_id === projectId);
  if (owned.length === 0) return 0;
  const completed = owned.filter((t) => t.completed === true).length;
  return Math.round((completed / owned.length) * 100);
}

// P2.7: Dashboard.jsx와 ProjectCard.jsx 둘 다 진행률 바의 width를 `${progress}%`로 인라인
// 계산하던 것을 여기로 모은다 — calculateProjectProgress는 항상 0~100 정수만 반환하므로 현재
// 호출 경로에서는 안전하지만(critical-reviewer가 두 호출부 전부 확인), 이 값은 궁극적으로는
// data.json에서 온 project 객체를 그대로 넘기는 새 호출부가 생길 수 있는 표시용 헬퍼라
// undefined/NaN/범위 밖 값이 들어와도 깨지지 않게 방어한다(같은 인라인 패턴이 두 곳에 복제돼
// 있던 드리프트도 함께 해소).
export function progressBarWidth(progress) {
  const clamped = Number.isFinite(progress) ? Math.min(100, Math.max(0, progress)) : 0;
  return `${clamped}%`;
}
