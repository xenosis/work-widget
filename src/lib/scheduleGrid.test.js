import { describe, it, expect } from 'vitest';
import {
  getMonthGrid,
  getWeekDates,
  getDayLabel,
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
