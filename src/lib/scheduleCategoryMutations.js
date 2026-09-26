// scheduleMutations.js와 같은 이유로 화면(Schedule.jsx) 밖으로 뺀 순수 함수들.
import { normalizeCategoryColor } from './categoryPalette.js';

// critical-reviewer 지적(P12.16 재검증 2라운드, Medium): id 없는 레코드를 걸러내는 필터를
// ScheduleCategoryManager.jsx 안에서만 하니, Schedule.jsx의 카드 배지(필터 전 길이)와 실제
// 렌더되는 행 수(필터 후)가 손상 데이터에서 서로 달라졌다 — getUsableProjects(projectLookup.js)
// 와 같은 이유로 한 곳에 모아 호출부(배지/목록) 둘 다 같은 필터를 쓰게 한다.
export function getUsableCategories(categories) {
  return categories.filter((c) => c && c.id);
}

// critical-reviewer 지적(P12.17 리뷰, High): ScheduleAddForm.jsx/ScheduleEditForm.jsx가
// select에서 고른 categoryId를 로컬 state에 들고 있다가 제출 시 존재 여부 검증 없이 그대로
// 저장했다 — 폼이 열린 채로(같은 화면의 "카테고리 관리" 패널에서) 그 카테고리가 삭제되면
// select는 화면상 "미분류"로 보이지만 state는 삭제된 id를 그대로 갖고 있어, 저장하면 고아
// category_id가 새로 생겼다(수기 편집 없이도 정상 사용 흐름에서 발생 — B3.4가 보장하는
// "삭제되면 null로 되돌아감" 전제와 어긋남). 제출 직전 항상 현재 유효한 카테고리 목록과
// 대조해 없는 id는 null로 되돌린다.
export function resolveSubmittableCategoryId(categoryId, categories) {
  return getUsableCategories(categories).some((c) => c.id === categoryId) ? categoryId : null;
}

export function applyCategoryUpdate(categories, categoryId, updates, now = new Date().toISOString()) {
  return categories.map((c) =>
    c && c.id === categoryId
      ? { ...c, ...updates, ...(updates.color !== undefined ? { color: normalizeCategoryColor(updates.color) } : {}), updated_at: now }
      : c
  );
}

export function removeCategory(categories, categoryId) {
  return categories.filter((c) => !(c && c.id === categoryId));
}

// P12.16 done_when: 카테고리 삭제 시 그 카테고리를 쓰던 일정은 "미분류"(category_id: null)로
// 되돌아간다 — 고아 참조로 남겨두면(P2.8의 project_id 고아 처리와 다른 선택) 나중에 그 id를
// 다른 새 카테고리가 재사용할 방법이 없어(crypto.randomUUID) 영구히 고아로 남기 때문에,
// 여기서는 조용히 삭제되도록 능동적으로 되돌린다.
export function unassignCategoryFromSchedules(schedules, categoryId, now = new Date().toISOString()) {
  return schedules.map((s) => (s && s.category_id === categoryId ? { ...s, category_id: null, updated_at: now } : s));
}
