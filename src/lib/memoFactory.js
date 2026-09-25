// B3.3 스키마를 만족하는 새 Memo 레코드 생성. todoFactory.js/projectFactory.js와 같은 이유로
// 인라인 대신 여기서 스키마를 채운다. project_id는 이 화면(B2.3)에 프로젝트 지정 UI가 없어
// 항상 null(전체/독립 메모)로 시작 — Memo의 project_id는 B3.3상 nullable이라 이게 유효한
// 최종 상태다(Todo와 달리 나중에 반드시 채워야 하는 값이 아님).
export function createMemo(now = new Date().toISOString()) {
  return {
    id: `memo-${crypto.randomUUID()}`,
    project_id: null,
    title: '',
    content: '',
    created_at: now,
    updated_at: now,
  };
}
