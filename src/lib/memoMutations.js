// P4.2: 제목/본문 수정. project_id는 이 화면에 재배정 UI가 없어(P4.2 범위 밖) updates에 실려
// 오지 않는다 — 실려 와도 그대로 병합되게 두어 나중에(예: 프로젝트 상세에서 메모 태그를
// 바꾸는 기능이 생기면) 이 함수를 그대로 재사용할 수 있게 한다. 단 id/created_at은 updates에
// 뭐가 오든 원본 값으로 다시 고정한다 — 그러지 않으면 호출부 실수로 그 두 필드가 실려 왔을 때
// 레코드의 정체성(id)이나 생성 시각이 조용히 바뀔 수 있다(critical-reviewer 지적).
export function applyMemoUpdate(memos, memoId, updates, now = new Date().toISOString()) {
  return (Array.isArray(memos) ? memos : []).map((m) =>
    m && m.id === memoId ? { ...m, ...updates, id: m.id, created_at: m.created_at, updated_at: now } : m
  );
}

export function removeMemo(memos, memoId) {
  return (Array.isArray(memos) ? memos : []).filter((m) => !(m && m.id === memoId));
}
