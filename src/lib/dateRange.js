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

// scheduleGrid.js(P5.1)도 같은 형식 검증을 재사용한다 — 0 채움 없는 날짜("2026-9-15")가
// 사전순 문자열 비교를 틀어지게 하는 문제를 두 곳에서 각자 막지 않기 위함.
export const DATE_STRING_RE = /^\d{4}-\d{2}-\d{2}$/;

// critical-reviewer 지적(P12.19 재검증 2라운드): DATE_STRING_RE는 형태(\d{4}-\d{2}-\d{2})만 보므로
// "2026-13-45"처럼 형태는 맞지만 실제로 없는 날짜도 통과시킨다. DueDatePicker.jsx만 왕복 검증을
// 쓰고 TodoEditForm.jsx/ProjectEditForm.jsx의 초기 state 정리는 여전히 DATE_STRING_RE만 썼더니,
// 그런 날짜가 폼 state엔 그대로 남은 채 DueDatePicker 화면엔 "날짜 선택"(빈 값)으로만 보여서
// "화면은 빈칸인데 저장은 깨진 값 그대로" 결함이 재발했다 — 화면 표시와 저장 정리 로직이 같은
// 판정 함수를 써야 어긋나지 않으므로 한 곳(dateRange.js)에 모은다.
export function isValidDateString(v) {
  if (typeof v !== 'string' || !DATE_STRING_RE.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  return formatLocalDate(new Date(y, m - 1, d)) === v;
}

// "이번주(월~일) 범위이면서 오늘은 아닌" 날짜인지. Dashboard.jsx(오늘/이번주 마감 목록)와
// src/lib/todoGrouping.js(오늘/이번주/나중 그룹) 둘 다 이 판정을 쓴다 — 각자 조건식을 따로 들고
// 있으면 한쪽만 고쳤을 때 두 화면의 "이번주"가 조용히 갈라지기 때문에 여기 한 곳으로 모았다.
// 0패딩된 YYYY-MM-DD 형식이 아니면(수기 편집된 data.json 등) "이번주"로 조용히 오분류되지 않도록
// 마감일 없음과 동일하게 취급한다(critical-reviewer 지적 — 문자열 사전순 비교라 포맷이 깨지면
// 엉뚱한 그룹에 들어갈 수 있었음).
// today/weekRange를 선택 인자로 받는다 — 한 화면에서 여러 todo를 순회하며 이 함수를 여러 번
// 부르는 호출부(todoGrouping.js, Dashboard.jsx)가 매번 새로 계산하지 않고 한 번 계산해 넘기면,
// 그 순회 도중 자정을 넘겨도 "오늘"이 중간에 바뀌는 일이 없다(critical-reviewer 지적). 인자를
// 생략하면 기존처럼 즉시 계산하므로 기존 호출부는 그대로 동작한다.
export function isThisWeekExcludingToday(dueDate, today = getTodayDateString(), weekRange = getThisWeekRange()) {
  if (typeof dueDate !== 'string' || !DATE_STRING_RE.test(dueDate)) return false;
  if (dueDate === today) return false;
  const { weekStart, weekEnd } = weekRange;
  return dueDate >= weekStart && dueDate <= weekEnd;
}
