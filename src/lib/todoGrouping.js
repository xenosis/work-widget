// B2.2: 할일을 오늘/이번주/나중 3그룹으로 나눈다.
// B2.2는 오늘/이번주/나중 3그룹만 규정하고 "이번주보다 더 전에 지난 마감"이나 "마감일 없음"을
// 어느 그룹에 넣을지는 정하지 않는다 — Dashboard.jsx(P1.1/P1.2)와 같은 해석으로 "이번주"는
// 오늘 제외 월~일 범위(이미 지난 이번주 날짜 포함), 그 밖의 전부(더 이전에 지난 것 + 마감일
// 없음 + 다음주 이후)는 "나중"으로 묶는다 — 3그룹 구조를 그대로 따르기 위함(화면에는 "나중"
// 제목에 "지난 마감 포함"을 덧붙여 라벨과 실제 내용이 어긋나지 않게 함).
import { getTodayDateString, isThisWeekExcludingToday } from './dateRange.js';
import { priorityRank, compareByDueDateThenPriority } from './priority.js';

export function groupTodosByDate(todos) {
  const today = getTodayDateString();
  // id 없는 레코드는 React key로 못 쓰므로 제외한다(Dashboard.jsx/Projects.jsx와 동일한 방어).
  const valid = (Array.isArray(todos) ? todos : []).filter((t) => t && typeof t.id === 'string');
  const droppedCount = (Array.isArray(todos) ? todos.length : 0) - valid.length;

  const todayGroup = [];
  const week = [];
  const later = [];
  for (const t of valid) {
    if (t.due_date === today) todayGroup.push(t);
    else if (isThisWeekExcludingToday(t.due_date)) week.push(t);
    else later.push(t);
  }

  todayGroup.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
  week.sort(compareByDueDateThenPriority);
  later.sort(compareByDueDateThenPriority);

  return { today: todayGroup, week, later, droppedCount };
}
