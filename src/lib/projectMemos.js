// B2.1 상세화면: 프로젝트에 소속된 메모 목록. project_id 매칭은 projectTodos.js와 같다.
// 메모 화면(Memos.jsx)에서 프로젝트를 지정/해제할 수 있다(P4.2 CRUD + P4.4 지정 UI) — id 없는
// 레코드가 조용히 사라지면 원인을 알 방법이 없으므로 projectTodos.js의 droppedCount 패턴을
// 그대로 따라 몇 개가 제외됐는지 함께 돌려준다.
// updated_at 내림차순으로 정렬한다 — B2.1/B2.3 모두 메모 정렬 기준을 규정하지 않아, 최근 수정한
// 메모가 먼저 보이는 쪽이 "메모 확인"이라는 용도에 더 맞다는 해석(스펙 미규정 영역).
export function getMemosForProject(memos, projectId) {
  const all = (Array.isArray(memos) ? memos : []).filter((m) => m && m.project_id === projectId);
  const valid = all.filter((m) => typeof m.id === 'string');
  valid.sort((a, b) => String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? '')));
  return { memos: valid, droppedCount: all.length - valid.length };
}
