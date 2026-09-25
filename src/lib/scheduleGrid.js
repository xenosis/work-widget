// P5.1 결정(2026-09-24): 외부 캘린더 라이브러리를 쓰지 않고 월간/주간 그리드 생성과 반복
// 일정 전개를 dateRange.js와 같은 패턴(순수 Date 계산 + vitest)으로 직접 구현한다. Schedule.jsx
// (P5.2/P5.3/P5.4)와 Dashboard.jsx(P1.4, 오늘 일정)가 이 모듈을 공유한다 — dateRange.js가
// "이번주" 정의를 여러 화면에 공유하는 것과 같은 이유(한쪽만 고치면 두 화면의 주/반복 판정이
// 조용히 갈라짐).
import { isHoliday } from 'korean-holidays';
import { formatLocalDate, DATE_STRING_RE } from './dateRange.js';

// B2.2/대시보드가 이미 월요일 시작을 확정했으므로(dateRange.js) 일정 화면도 같은 주 경계를 쓴다.
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

// year/month(0-indexed)가 속한 달을 월요일 시작 주 단위로 채운 그리드. 앞뒤로 인접 달의
// 날짜를 채워 항상 7의 배수 칸(5주 또는 6주)을 돌려준다 — 달력 UI가 매달 다른 줄 수로
// 들쭉날쭉해지는 것을 막기 위함.
export function getMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const firstDow = firstOfMonth.getDay(); // 0=일 ... 6=토
  const leadingDays = firstDow === 0 ? 6 : firstDow - 1;
  const gridStart = new Date(year, month, 1 - leadingDays);

  const lastOfMonth = new Date(year, month + 1, 0);
  const lastDow = lastOfMonth.getDay();
  const trailingDays = lastDow === 0 ? 0 : 7 - lastDow;
  const totalDays = leadingDays + lastOfMonth.getDate() + trailingDays;

  const cells = [];
  for (let i = 0; i < totalDays; i += 1) {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    cells.push({
      date: formatLocalDate(date),
      inCurrentMonth: date.getFullYear() === year && date.getMonth() === month,
    });
  }

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

// 주어진 날짜가 속한 주(월~일)의 7일. dateRange.js의 getThisWeekRange와 같은 월요일 시작
// 규칙이지만, 일정 화면은 "이번주"뿐 아니라 임의 날짜 기준 이전/다음 주 이동이 필요해 날짜를
// 인자로 받도록 일반화했다.
export function getWeekDates(dateString) {
  const [y, m, d] = dateString.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + mondayOffset);
  const days = [];
  for (let i = 0; i < 7; i += 1) {
    days.push(formatLocalDate(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)));
  }
  return days;
}

export function getDayLabel(dateString) {
  const [y, m, d] = dateString.split('-').map(Number);
  return DAY_LABELS[new Date(y, m - 1, d).getDay()];
}

// P12.8(P12.7 결정): 공휴일 판정을 korean-holidays 패키지에 위임한다. 이 라이브러리는 Date
// 객체의 로컬 연/월/일만 보고 판정하므로(내부적으로 UTC 변환을 하지 않음 — README 예제도
// new Date(y, m, d) 형태의 로컬 Date를 씀), dateString을 new Date(y, m-1, d)로 그대로
// 풀어서 넘긴다. 반환값을 그대로 쓰지 않고 이 프로젝트가 이미 쓰는 필드명(name)으로 다시 감싸서
// 호출부가 라이브러리의 원본 인터페이스(nameKo 등)를 몰라도 되게 한다.
export function getHolidayInfo(dateString) {
  const [y, m, d] = dateString.split('-').map(Number);
  const holiday = isHoliday(new Date(y, m - 1, d));
  if (!holiday) return null;
  return { name: holiday.nameKo, isSubstitute: holiday.isSubstitute, isLunar: holiday.isLunar };
}

// P12.6: 월간/주간 헤더·셀에 주말 색을 구분해 붙이기 위한 순수 판정. 컴포넌트가 getDayLabel과
// 같은 dateString 인자 하나만으로 호출할 수 있게 해서, 월간 그리드(인접 달 날짜 포함)와 주간
// 그리드(getWeekDates) 양쪽에서 같은 함수를 그대로 재사용한다.
export function getWeekdayKind(dateString) {
  const [y, m, d] = dateString.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  if (dow === 0) return 'sunday';
  if (dow === 6) return 'saturday';
  return 'weekday';
}

// P12.19(critical-reviewer 지적): 월간 그리드 셀의 CSS 클래스 계산(주말/공휴일/다른 달/오늘/
// 선택됨)이 ScheduleMonthView.jsx와 DueDatePicker.jsx 두 곳에 그대로 복붙돼 있어서, 한쪽만
// 고치면 두 달력의 색·상태 표시가 조용히 갈라질 위험이 있었다 — 공용 순수 함수로 뽑아 두 곳이
// 같은 걸 쓰게 한다. `cell`은 getMonthGrid가 돌려주는 { date, inCurrentMonth } 형태.
export function getDayCellClassNames(cell, { today, selectedDate } = {}) {
  const weekdayKind = getWeekdayKind(cell.date);
  const holiday = getHolidayInfo(cell.date);
  const classNames = ['schedule-day-cell'];
  if (weekdayKind !== 'weekday') classNames.push(`is-${weekdayKind}`);
  if (holiday) classNames.push('is-holiday');
  if (!cell.inCurrentMonth) classNames.push('is-outside');
  if (cell.date === today) classNames.push('is-today');
  if (cell.date === selectedDate) classNames.push('is-selected');
  return classNames.join(' ');
}

// P6.6 결정(critical-reviewer 지적, P6.4 리뷰): schedule.is_recurring이 boolean이 아닌 값(예:
// 문자열 "false")이면 화면마다 truthy 판정과 === true 판정이 섞여 서로 다르게 해석했다 —
// 판정을 이 함수 하나로 통일한다(엄격 비교: true가 아니면 전부 비반복으로 취급).
// critical-reviewer 지적: 공용 판정 함수인데 null 가드가 없어, 지금은 호출부의 사전 필터에
// 암묵적으로 의존한다 — 그 전제가 깨지지 않도록 옵셔널 체이닝으로 직접 방어한다.
export function isScheduleRecurring(schedule) {
  return schedule?.is_recurring === true;
}

// B3.4: 일회성 일정은 date === dateString일 때만 노출한다. 반복 일정은 "date"가 반복이
// 시작되는 기준일이라는 필드 설명에 따라 그 날짜 이후(포함)이고, 그 날의 요일이
// recurrence_days에 포함될 때만 노출한다(기준일 이전으로 소급 노출하지 않음). critical-reviewer
// 지적: 0 채움 없는 날짜("2026-9-15")는 사전순 문자열 비교(dateString >= s.date)를 틀어지게
// 해서 반복 일정이 특정 달부터 조용히 사라질 수 있었다 — dateRange.js와 같은 형식 검증을 쓴다.
export function getSchedulesForDate(schedules, dateString) {
  const label = getDayLabel(dateString);
  return schedules.filter((s) => {
    if (!s) return false;
    if (isScheduleRecurring(s)) {
      return (
        typeof s.date === 'string' &&
        DATE_STRING_RE.test(s.date) &&
        dateString >= s.date &&
        Array.isArray(s.recurrence_days) &&
        s.recurrence_days.includes(label)
      );
    }
    return s.date === dateString;
  });
}

// P5.2 월 이동 버튼(이전/다음 달)의 12↔1월 연도 경계 처리를 컴포넌트 밖으로 빼서 테스트
// 대상으로 만든다 — critical-reviewer 지적: Schedule.jsx에 인라인으로 있으면 이 프로젝트에서
// 유일하게 유의미한 순수함수 테스트 대상(gate=npm test)인데도 실제로는 검증되지 않는다.
export function shiftMonth({ year, month }, delta) {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

// P5.3 주간 뷰의 이전/다음 주 이동. new Date(y, m, d+delta)가 월/연 경계를 자동 정규화하므로
// shiftMonth와 달리 별도 경계 처리가 필요 없다(dateRange.js의 getThisWeekRange와 같은 근거).
export function shiftDate(dateString, days) {
  const [y, m, d] = dateString.split('-').map(Number);
  return formatLocalDate(new Date(y, m - 1, d + days));
}

// P5.7 결정(사람, 2026-09-25): 트레이 재표시/포커스 등으로 다시 렌더될 때 "오늘"이 실제로
// 바뀐 경우에만 그리드·선택 날짜를 오늘로 리셋한다 — 그 리셋 목표값 계산을 Schedule.jsx 밖으로
// 빼서 테스트 대상으로 만든다(critical-reviewer 지적: 이 비교/리셋 로직이 컴포넌트 안에만
// 있으면 gate=npm test로 검증할 수 없다).
export function todayResetCursors(todayStr) {
  const [y, m] = todayStr.split('-').map(Number);
  return {
    selectedDate: todayStr,
    monthCursor: { year: y, month: m - 1 },
    weekAnchor: todayStr,
  };
}
