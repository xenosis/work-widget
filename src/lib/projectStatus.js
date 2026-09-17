// B4.3: 프로젝트 상태 자동 전환.
// - 소속 todo가 모두 완료되면 자동으로 "완료".
// - "완료" 상태에서 todo가 추가되거나 완료가 취소되면(=더 이상 전부 완료가 아니면) 자동으로 "진행중".
// - "보류"는 사용자가 직접 지정하는 상태라 여기서는 절대 건드리지 않는다.
// - 소속 todo가 0개인 경우는 B4.3에 규정이 없다 — calculateProjectProgress(P6.1)가 0개를 "아직
//   시작 전"으로 보고 0%로 취급하는 것과 방향을 맞춰, 여기서도 "전부 완료"로 보지 않는다(완료 상태인
//   프로젝트의 todo를 전부 지우면 "진행중"으로 되돌아감 — 스펙 미규정 영역의 해석).
// calculateProjectProgress(projectId, todos)와 동일한 계약: todos는 프로젝트 전체 todo 배열을
// 그대로 받아 내부에서 project_id로 필터링한다(호출자가 미리 거르지 않아도 됨).
// project.status를 직접 바꾸지 않고 다음 상태값만 계산해서 반환한다 — 실제 저장은 호출한 쪽(IPC 저장
// 경로)의 책임이다.
const KNOWN_STATUSES = ['진행중', '완료', '보류'];

export function deriveProjectStatus(currentStatus, projectId, todos) {
  if (currentStatus === '보류') return currentStatus;

  const list = Array.isArray(todos) ? todos : [];
  const owned = list.filter((t) => t && t.project_id === projectId);
  const allComplete = owned.length > 0 && owned.every((t) => t.completed === true);

  if (allComplete) return '완료';
  if (currentStatus === '완료') return '진행중';
  // enum 밖 값(오타/구버전 데이터 등)이 들어와도 저장 경로로 그대로 흘려보내지 않는다.
  return KNOWN_STATUSES.includes(currentStatus) ? currentStatus : '진행중';
}
