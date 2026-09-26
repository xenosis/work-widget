// B3.5 스키마를 만족하는 새 BacklogSource 레코드 생성 — scheduleCategoryFactory.js와 같은 이유로
// 분리한다. label은 이 단계에서 사용자가 직접 입력하는 UI를 두지 않고(범위를 최소로 유지) 항상
// null로 시작한다 — 화면 표시 시 backlogSourceMutations.js의 getSourceDisplayLabel이 path에서
// 유도한 이름으로 대체한다(Project.progress처럼 읽을 때 계산하는 파생값과 같은 패턴).
export function createBacklogSource({ path }, now = new Date().toISOString()) {
  return {
    id: `backlog-source-${crypto.randomUUID()}`,
    path,
    label: null,
    created_at: now,
    updated_at: now,
  };
}
