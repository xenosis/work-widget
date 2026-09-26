// P12.16(P12.10 사람 결정: 자유 색상이 아니라 고정 팔레트 방식): 일정 카테고리가 고를 수
// 있는 색은 이 7가지로 고정한다. Schedule_categories 레코드의 color 필드는 이 배열의 key를
// 그대로 저장한다(실제 색값이 아니라 이름표) — index.css의 --category-* 토큰과 팔레트 값이
// 나중에 조정돼도 이미 저장된 데이터는 마이그레이션 없이 새 색을 그대로 물려받는다(priority
// 필드가 '상'/'중'/'하' 문자열을 저장하고 실제 색은 CSS가 담당하는 것과 같은 방식).
export const CATEGORY_PALETTE = [
  { key: 'red', label: '빨강' },
  { key: 'orange', label: '주황' },
  { key: 'yellow', label: '노랑' },
  { key: 'green', label: '초록' },
  { key: 'blue', label: '파랑' },
  { key: 'purple', label: '보라' },
  { key: 'gray', label: '회색' },
];

const PALETTE_KEYS = new Set(CATEGORY_PALETTE.map((c) => c.key));

// 손상되거나 팔레트 밖의 값(수기 편집된 data.json 등)이 들어와도 항상 유효한 키로 정규화한다
// — 화면은 이 함수를 거친 값만 믿고 CSS 클래스(is-{color})를 그대로 붙일 수 있다.
export function normalizeCategoryColor(color) {
  return typeof color === 'string' && PALETTE_KEYS.has(color) ? color : 'gray';
}

// P12.17: 일정의 category_id로 실제 카테고리 레코드를 찾아 표시용 값(색/이름)을 뽑아내는 조회
// 헬퍼 — 월간/주간 셀(scheduleGrid.js), 날짜 상세(ScheduleDateDetail.jsx), 폼(ScheduleAddForm.jsx/
// ScheduleEditForm.jsx)이 각자 같은 조회 로직을 복붙하면 한쪽만 고쳤을 때 갈라질 위험이 있어
// (getDayCellClassNames/getUsableCategories와 같은 이유) 한 곳에 모은다. category_id가 null이거나
// (미분류) 그 id의 카테고리가 이미 삭제된 경우(예: 수기 편집으로 남은 고아 참조 — 정상 경로로는
// P12.16의 unassignCategoryFromSchedules가 삭제 시 항상 null로 되돌리므로 생기지 않지만 방어)
// 둘 다 "미분류"로 취급해 null을 돌려준다.
function findCategory(categoryId, categories) {
  if (!categoryId) return null;
  return categories.find((c) => c && c.id === categoryId) ?? null;
}

export function resolveCategoryColor(categoryId, categories) {
  const found = findCategory(categoryId, categories);
  return found ? normalizeCategoryColor(found.color) : null;
}

export function resolveCategoryName(categoryId, categories) {
  const found = findCategory(categoryId, categories);
  return found && typeof found.name === 'string' && found.name ? found.name : null;
}
