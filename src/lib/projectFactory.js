// B3.1 스키마를 만족하는 새 Project 레코드 생성. todoFactory.js(P2.3)와 동일한 이유로 이
// 앱의 두 번째 쓰기 경로(P2.5)에서도 인라인 대신 여기서 스키마를 채운다 — 자동 검증 가능하게.
// status는 입력폼이 없어 항상 "진행중"으로 시작(B4.3: "완료"는 할일 전부 완료 시에만 자동
// 전환되고, "보류"는 사용자가 나중에 직접 지정하는 값이라 생성 시점엔 의미가 없다).
export function createProject(name, type, now = new Date().toISOString()) {
  return {
    id: `project-${crypto.randomUUID()}`,
    name,
    type,
    status: '진행중',
    description: null,
    due_date: null,
    created_at: now,
    updated_at: now,
  };
}
