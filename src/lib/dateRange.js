// 로컬 타임존 기준 날짜 문자열(YYYY-MM-DD) 유틸 + "이번주" 경계 계산.
// electron/dataStore.js 주석에 명시된 계약(due_date 등은 로컬 YYYY-MM-DD 문자열)과 짝을 이룬다.
// 여러 화면(Dashboard의 오늘/이번주 마감, 이후 Todos의 오늘/이번주/나중 그룹핑 등)이 같은 "이번주"
// 정의를 공유해야 하므로 여기 한 곳에만 둔다.
//
// 주 시작 요일은 요구사항 문서(work-widget-requirements.md)에 규정이 없다 — 월요일 시작으로
// 해석해서 구현한 결정이며, 이 구현 결정이 모든 화면에 일관되게 적용되도록 이 모듈을 공유한다.

export function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayDateString() {
  return formatLocalDate(new Date());
}

// 오늘이 속한 주의 월요일~일요일을 "YYYY-MM-DD" 문자열 쌍으로 반환한다.
// new Date(year, month, day + offset)는 월/연 경계를 자동으로 정규화하므로 월말/연말에도 안전하다.
export function getThisWeekRange() {
  const now = new Date();
  const dow = now.getDay(); // 0=일 ... 6=토
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return { weekStart: formatLocalDate(monday), weekEnd: formatLocalDate(sunday) };
}

// "이번주(월~일) 범위이면서 오늘은 아닌" 날짜인지. Dashboard.jsx(오늘/이번주 마감 목록)와
// src/lib/todoGrouping.js(오늘/이번주/나중 그룹) 둘 다 이 판정을 쓴다 — 각자 조건식을 따로 들고
// 있으면 한쪽만 고쳤을 때 두 화면의 "이번주"가 조용히 갈라지기 때문에 여기 한 곳으로 모았다.
export function isThisWeekExcludingToday(dueDate) {
  if (typeof dueDate !== 'string') return false;
  const today = getTodayDateString();
  if (dueDate === today) return false;
  const { weekStart, weekEnd } = getThisWeekRange();
  return dueDate >= weekStart && dueDate <= weekEnd;
}
