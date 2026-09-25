import { describe, it, expect } from 'vitest';
import {
  getMonthGrid,
  getWeekDates,
  getDayLabel,
  getWeekdayKind,
  getHolidayInfo,
  getDayCellClassNames,
  getSchedulesForDate,
  shiftMonth,
  shiftDate,
  isScheduleRecurring,
  todayResetCursors,
} from './scheduleGrid.js';

describe('getMonthGrid', () => {
  it('2026년 9월(30일, 화요일 시작)을 월요일 시작 5주 그리드로 채운다', () => {
    const weeks = getMonthGrid(2026, 8); // 0-indexed: 8=9월
    expect(weeks.length).toBe(5);
    expect(weeks[0][0].date).toBe('2026-08-31'); // 8/31(월)부터 시작
    expect(weeks[0][0].inCurrentMonth).toBe(false);
    expect(weeks[0][1].date).toBe('2026-09-01');
    expect(weeks[0][1].inCurrentMonth).toBe(true);
    const lastWeek = weeks[weeks.length - 1];
    expect(lastWeek[lastWeek.length - 1].date).toBe('2026-10-04'); // 10/4(일)로 끝
  });

  it('모든 주는 항상 7칸이다', () => {
    const weeks = getMonthGrid(2026, 1); // 2월(28일, 일요일 시작)
    weeks.forEach((week) => expect(week.length).toBe(7));
  });

  it('연 경계(12월->1월)를 정규화해서 처리한다', () => {
    const weeks = getMonthGrid(2026, 11); // 12월
    const flat = weeks.flat();
    expect(flat.some((c) => c.date === '2027-01-02')).toBe(true);
  });
});

describe('getWeekDates', () => {
  it('수요일 날짜를 넣으면 그 주 월~일 7일을 반환한다', () => {
    const days = getWeekDates('2026-09-24'); // 목요일
    expect(days).toEqual([
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
    ]);
  });

  it('일요일 날짜를 넣어도 그 주의 월요일부터 시작한다', () => {
    const days = getWeekDates('2026-09-27');
    expect(days[0]).toBe('2026-09-21');
    expect(days[6]).toBe('2026-09-27');
  });
});

describe('getDayLabel', () => {
  it('날짜 문자열의 요일을 한글로 반환한다', () => {
    expect(getDayLabel('2026-09-24')).toBe('목');
    expect(getDayLabel('2026-09-27')).toBe('일');
  });
});

// P12.6: 달력에 평일/주말 색을 구분해 표시하려면 요일 판정이 date-fns 등 없이도 정확해야 한다.
describe('getWeekdayKind', () => {
  it('토요일은 saturday를 반환한다', () => {
    expect(getWeekdayKind('2026-09-26')).toBe('saturday');
  });

  it('일요일은 sunday를 반환한다', () => {
    expect(getWeekdayKind('2026-09-27')).toBe('sunday');
  });

  it('평일(월~금)은 weekday를 반환한다', () => {
    expect(getWeekdayKind('2026-09-21')).toBe('weekday'); // 월
    expect(getWeekdayKind('2026-09-24')).toBe('weekday'); // 목
  });

  // critical-reviewer 지적(P12.6 리뷰, Medium): 같은 주의 날짜 4개만 확인해서는 getMonthGrid가
  // 채우는 인접 달 날짜(월 경계)에도 이 판정이 맞물려 정확히 적용되는지, 그리고 그리드의 5/6번째
  // 열이 실제로 항상 토/일인지 보호하지 못한다 — 두 달(연 경계 포함)의 모든 주를 직접 돈다.
  it('월 경계를 넘는 인접 달 날짜를 포함해 모든 주에서 5,6번째 열이 토/일이다', () => {
    const monthsToCheck = [
      getMonthGrid(2026, 8), // 9월(8/31 월요일 시작)
      getMonthGrid(2026, 11), // 12월(연 경계 넘어 2027-01로 이어짐)
      // critical-reviewer 지적(재검증 관찰): 위 두 달은 모두 화요일 시작이라 앞쪽 인접 달의
      // 토/일이 한 번도 커버되지 않았다 — 11월(일요일 시작, 앞쪽 채움 6칸)을 추가해 앞쪽 인접
      // 달의 토(10/31)까지 포함시킨다.
      getMonthGrid(2026, 10), // 11월(일요일 시작 → 10/26 월요일부터 채움, 10/31 토 포함)
    ];
    monthsToCheck.forEach((weeks) => {
      weeks.forEach((week) => {
        expect(week).toHaveLength(7);
        week.slice(0, 5).forEach((cell) => expect(getWeekdayKind(cell.date)).toBe('weekday'));
        expect(getWeekdayKind(week[5].date)).toBe('saturday');
        expect(getWeekdayKind(week[6].date)).toBe('sunday');
      });
    });
  });
});

// P12.19(critical-reviewer 지적): ScheduleMonthView.jsx/DueDatePicker.jsx가 각자 복붙하던 셀
// className 계산을 이 순수 함수로 통합 — 한 곳만 검증하면 둘 다 보장된다. 2026-09-26(토요일+
// 추석 연휴)처럼 실측 겹침 사례로 조합을 검증한다.
describe('getDayCellClassNames', () => {
  it('기본/조합 케이스', () => {
    const plain = { date: '2026-09-28', inCurrentMonth: true }; // 월요일, 공휴일 아님
    const satHoliday = { date: '2026-09-26', inCurrentMonth: true }; // 토요일, 추석 연휴
    expect(getDayCellClassNames(plain, {})).toBe('schedule-day-cell');
    expect(getDayCellClassNames(satHoliday, {})).toBe('schedule-day-cell is-saturday is-holiday');
    expect(getDayCellClassNames({ date: '2026-09-27', inCurrentMonth: true }, {})).toBe('schedule-day-cell is-sunday');
    expect(getDayCellClassNames({ date: '2026-08-31', inCurrentMonth: false }, {})).toBe('schedule-day-cell is-outside');
    expect(getDayCellClassNames(plain, { today: '2026-09-28' })).toBe('schedule-day-cell is-today');
    expect(getDayCellClassNames(plain, { selectedDate: '2026-09-28' })).toBe('schedule-day-cell is-selected');
    expect(getDayCellClassNames(satHoliday, { today: '2026-09-26', selectedDate: '2026-09-26' })).toBe(
      'schedule-day-cell is-saturday is-holiday is-today is-selected'
    );
  });
});

// P12.8(P12.7 결정): korean-holidays 패키지 위임 결과가 로컬 날짜 기준으로 맞는지 확인한다.
// node -e로 2026년 전체를 직접 돌려 확인한 실측값(로컬 Date 생성 기준)을 그대로 테스트 값으로
// 쓴다 — 이 라이브러리는 내부적으로 UTC가 아닌 로컬 연/월/일로 판정하므로, toISOString()으로
// 확인하면 시간대 차이(KST=UTC+9)로 하루 밀려 보인다(직접 검증하며 겪은 함정 — dateRange.js의
// formatLocalDate가 존재하는 이유와 같은 종류의 문제).
describe('getHolidayInfo', () => {
  it('고정 공휴일(신정)을 판정한다', () => {
    expect(getHolidayInfo('2026-01-01')).toEqual({ name: '신정', isSubstitute: false, isLunar: false });
  });

  it('음력 공휴일(설날)을 판정한다', () => {
    const result = getHolidayInfo('2026-02-17');
    expect(result.name).toBe('설날');
    expect(result.isLunar).toBe(true);
  });

  it('대체공휴일을 판정한다(2026년 3·1절은 일요일이라 3/2가 대체공휴일)', () => {
    expect(getHolidayInfo('2026-03-01')).toEqual({ name: '3·1절', isSubstitute: false, isLunar: false });
    const substitute = getHolidayInfo('2026-03-02');
    expect(substitute.isSubstitute).toBe(true);
    // critical-reviewer 지적(High): name에 이미 "대체공휴일 (원래 공휴일명)" 접두어가 포함돼
    // 있다 — 화면(ScheduleDateDetail.jsx)이 isSubstitute를 보고 접미어를 또 붙이면 중복 표시된다.
    expect(substitute.name).toBe('대체공휴일 (3·1절)');
  });

  it('공휴일이 아닌 날짜는 null이다', () => {
    expect(getHolidayInfo('2026-09-28')).toBeNull(); // 평일, 공휴일 아님
  });

  // critical-reviewer 지적(High, 재검증에서 발견): 의존 라이브러리 korean-lunar-calendar의
  // 음력 변환 데이터가 2050-11-18(양력 2050-12-31)까지만 있어서, 음력 공휴일(설날/석가탄신일/
  // 추석)은 2051년부터 에러 없이 조용히 사라진다 — B2.4에 문서화한 이 한계를 테스트로 고정한다.
  // 고정 공휴일(신정 등)은 이 제한과 무관하다. 아래 테스트는 isLunar===true인 공휴일만 세므로
  // (라이브러리가 대체공휴일엔 isLunar:false를 붙임) 음력 공휴일에서 파생되는 대체공휴일 자체를
  // 직접 검증하지는 않는다 — 다만 그 대체공휴일은 음력 공휴일이 있어야만 생기므로, 음력
  // 공휴일이 0건이면 그 대체공휴일도 논리적으로 생길 수 없다(critical-reviewer 지적, 4차
  // 재검증: 주석이 "대체공휴일까지 고정한다"고 과장돼 있었음 — 정정).
  // critical-reviewer 지적(Medium, 3차 재검증): 특정 날짜(예: "2051-09-01") 하나가 null인 것은
  // 그 날짜가 애초에 공휴일이 아닐 뿐일 수도 있어(추석은 음력 8/15라 양력 9월 초에는 절대 오지
  // 않는다) 아무것도 검증하지 못하는 얕은 테스트였다 — 한 해 전체를 순회해 음력 공휴일이
  // "하나도 없는지"를 직접 확인하고, 대조군으로 2050년엔 실제로 있는지(node -e로 실측:
  // 2050-01-23 설날, 2050-05-28 석가탄신일, 2050-09-30 추석 등 7건)도 함께 확인해 이 테스트가
  // "라이브러리 한계 때문에 비어 있다"는 것을 실제로 검증하게 만든다.
  function lunarHolidaysInYear(year) {
    const found = [];
    for (let m = 0; m < 12; m += 1) {
      for (let d = 1; d <= 31; d += 1) {
        const date = new Date(year, m, d);
        if (date.getMonth() !== m) continue; // 그 달에 없는 날짜(31일 등) 건너뜀
        const dateString = `${date.getFullYear()}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const info = getHolidayInfo(dateString);
        if (info?.isLunar) found.push(dateString);
      }
    }
    return found;
  }

  it('음력 공휴일은 라이브러리 지원 범위(~2050) 안에서는 실제로 나타난다(대조군)', () => {
    expect(lunarHolidaysInYear(2050).length).toBeGreaterThan(0);
  });

  it('음력 공휴일은 라이브러리 지원 범위(~2050) 밖(2051년)이면 한 건도 없다(고정 공휴일은 영향 없음)', () => {
    expect(lunarHolidaysInYear(2051)).toEqual([]);
    expect(getHolidayInfo('2051-01-01')).toEqual({ name: '신정', isSubstitute: false, isLunar: false });
  });
});

describe('getSchedulesForDate', () => {
  it('일회성 일정은 date가 정확히 일치할 때만 노출한다', () => {
    const schedules = [{ id: 's1', date: '2026-09-24', is_recurring: false }];
    expect(getSchedulesForDate(schedules, '2026-09-24')).toHaveLength(1);
    expect(getSchedulesForDate(schedules, '2026-09-25')).toHaveLength(0);
  });

  it('반복 일정은 기준일 이후이고 요일이 맞을 때만 노출한다', () => {
    const schedules = [
      { id: 's1', date: '2026-09-24', is_recurring: true, recurrence_days: ['화', '목'] },
    ];
    expect(getSchedulesForDate(schedules, '2026-10-01')).toHaveLength(1); // 목요일
    expect(getSchedulesForDate(schedules, '2026-09-29')).toHaveLength(1); // 화요일
    expect(getSchedulesForDate(schedules, '2026-09-30')).toHaveLength(0); // 수요일
  });

  it('반복 일정은 기준일 이전 날짜에는 소급 노출하지 않는다', () => {
    const schedules = [
      { id: 's1', date: '2026-09-24', is_recurring: true, recurrence_days: ['목'] },
    ];
    expect(getSchedulesForDate(schedules, '2026-09-17')).toHaveLength(0); // 기준일 이전 목요일
  });

  it('null 원소는 안전하게 건너뛴다', () => {
    const schedules = [null, { id: 's1', date: '2026-09-24', is_recurring: false }];
    expect(getSchedulesForDate(schedules, '2026-09-24')).toHaveLength(1);
  });

  it('반복 일정의 기준일이 0 채움 없는 형식이면 노출하지 않는다(사전순 비교 오작동 방지)', () => {
    const schedules = [
      { id: 's1', date: '2026-9-15', is_recurring: true, recurrence_days: ['화'] },
    ];
    expect(getSchedulesForDate(schedules, '2026-10-06')).toHaveLength(0); // 화요일이지만 형식이 깨짐
  });
});

describe('shiftMonth', () => {
  it('12월에서 다음 달로 넘기면 다음 해 1월이 된다', () => {
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
  });

  it('1월에서 이전 달로 넘기면 전 해 12월이 된다', () => {
    expect(shiftMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
  });

  it('연 경계가 아니면 월만 바뀐다', () => {
    expect(shiftMonth({ year: 2026, month: 5 }, 1)).toEqual({ year: 2026, month: 6 });
  });
});

describe('shiftDate', () => {
  it('일 단위로 날짜를 이동한다', () => {
    expect(shiftDate('2026-09-24', 7)).toBe('2026-10-01');
    expect(shiftDate('2026-09-24', -7)).toBe('2026-09-17');
  });

  it('연 경계를 넘어도 정규화된다', () => {
    expect(shiftDate('2026-12-30', 7)).toBe('2027-01-06');
  });

  it('뒤로 가면서 연 경계를 넘어도 정규화된다', () => {
    expect(shiftDate('2027-01-03', -7)).toBe('2026-12-27');
  });
});

// P6.6: is_recurring이 boolean이 아닌 값이어도 화면마다 다르게 해석되지 않도록(critical-reviewer
// 지적, P6.4 리뷰) 판정을 이 함수 하나로 고정한다.
describe('isScheduleRecurring', () => {
  it('true일 때만 반복으로 판정한다', () => {
    expect(isScheduleRecurring({ is_recurring: true })).toBe(true);
    expect(isScheduleRecurring({ is_recurring: false })).toBe(false);
  });

  it('boolean이 아닌 값(문자열 "false" 등)은 전부 비반복으로 취급한다', () => {
    expect(isScheduleRecurring({ is_recurring: 'false' })).toBe(false);
    expect(isScheduleRecurring({ is_recurring: 1 })).toBe(false);
    expect(isScheduleRecurring({ is_recurring: undefined })).toBe(false);
  });

  it('null/undefined 레코드에도 죽지 않고 false를 돌려준다', () => {
    expect(isScheduleRecurring(null)).toBe(false);
    expect(isScheduleRecurring(undefined)).toBe(false);
  });
});

// P5.7: 재표시/자정 경과로 오늘이 바뀐 걸 감지했을 때 그리드·선택 날짜를 어디로 되돌릴지 계산.
describe('todayResetCursors', () => {
  it('오늘 날짜로 selectedDate/weekAnchor를 맞추고 monthCursor는 0-인덱스 월로 계산한다', () => {
    expect(todayResetCursors('2026-09-25')).toEqual({
      selectedDate: '2026-09-25',
      monthCursor: { year: 2026, month: 8 },
      weekAnchor: '2026-09-25',
    });
  });

  it('연/월 경계 날짜도 올바르게 계산한다', () => {
    expect(todayResetCursors('2027-01-01')).toEqual({
      selectedDate: '2027-01-01',
      monthCursor: { year: 2027, month: 0 },
      weekAnchor: '2027-01-01',
    });
  });
});
