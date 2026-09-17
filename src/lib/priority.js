// B4.2: 할일 우선순위(상/중/하) 정렬 순서. Dashboard.jsx(오늘/이번주 마감 목록)와
// Todos.jsx(오늘/이번주/나중 그룹) 양쪽에서 같은 정의를 써야 하므로 여기 한 곳에 둔다.
const PRIORITY_ORDER = { 상: 0, 중: 1, 하: 2 };

// 알 수 없는 값(오타, 누락 등)은 맨 뒤로 보낸다.
export function priorityRank(priority) {
  return Object.hasOwn(PRIORITY_ORDER, priority) ? PRIORITY_ORDER[priority] : 3;
}

// P9(디자인): 우선순위별 색상 클래스(index.css의 .todo-dot/.priority-chip 등에서 씀).
// 알 수 없는 값은 "하"와 같은 낮은 톤(low)으로 처리 — priorityRank의 "맨 뒤" 취급과 방향을 맞춤.
export function priorityClassName(priority) {
  if (priority === '상') return 'high';
  if (priority === '중') return 'mid';
  return 'low';
}

// B4.2: 마감일 순 우선(없으면 맨 뒤), 같으면 우선순위 순.
// due_date가 문자열이 아니면(null/undefined 등 전부) "없음"으로 정규화해서 비교한다 — null과
// undefined를 다르게 취급하면 compare(a,b)와 compare(b,a)가 둘 다 양수를 반환하는 비대칭
// 비교자가 되어 정렬 결과가 자바스크립트 엔진 구현에 따라 달라지는 버그가 생긴다.
export function compareByDueDateThenPriority(a, b) {
  const aDate = typeof a.due_date === 'string' ? a.due_date : null;
  const bDate = typeof b.due_date === 'string' ? b.due_date : null;
  if (aDate !== bDate) {
    if (aDate === null) return 1;
    if (bDate === null) return -1;
    return aDate < bDate ? -1 : 1;
  }
  return priorityRank(a.priority) - priorityRank(b.priority);
}
