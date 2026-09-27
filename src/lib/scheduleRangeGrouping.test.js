// P23: getSchedulesInRange/getScheduleRangeDates 전용 테스트 — scheduleGrid.test.js가 이미
// 300줄 한도에 바짝 붙어 있어(다른 함수들 테스트로 이미 꽉 참) 새 함수 테스트를 별도 파일로
// 분리한다.
import { describe, it, expect } from 'vitest';
import { getSchedulesInRange, getScheduleRangeDates } from './scheduleGrid.js';

describe('getSchedulesInRange', () => {
  it('일정 있는 날짜만 날짜순으로 묶고, 반복 일정은 발생일마다 나타난다', () => {
    const schedules = [
      { id: 's1', date: '2026-09-24', is_recurring: false, title: 'A' },
      { id: 's2', date: '2026-09-01', is_recurring: true, recurrence_days: ['화'], title: 'B' },
    ];
    const dateStrings = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25']; // 월~금
    const { groups, droppedCount } = getSchedulesInRange(schedules, dateStrings); // 화(22,반복B)+목(24,A)
    expect(groups.map((r) => r.date)).toEqual(['2026-09-22', '2026-09-24']);
    expect(groups[0].items[0].title).toBe('B');
    expect(droppedCount).toBe(0);
  });

  it('아무 날짜에도 일정이 없으면 빈 groups를 돌려준다', () => {
    expect(getSchedulesInRange([], ['2026-09-21', '2026-09-22'])).toEqual({ groups: [], droppedCount: 0 });
  });

  // critical-reviewer 지적(High): id 없는 레코드만 있는 날짜는 groups에 빈 items로 남으면
  // 안 되고(화면이 "일정 있음"과 "없음" 사이에서 모순된 상태가 됨), droppedCount로 집계돼야
  // 한다.
  it('id 없는 레코드만 있는 날짜는 groups에서 아예 빠지고 droppedCount에 잡힌다', () => {
    const schedules = [{ date: '2026-09-24', is_recurring: false, title: 'no id' }];
    const { groups, droppedCount } = getSchedulesInRange(schedules, ['2026-09-24']);
    expect(groups).toEqual([]);
    expect(droppedCount).toBe(1);
  });
});

describe('getScheduleRangeDates', () => {
  it('주간이면 getWeekDates 그대로 7일을 돌려준다', () => {
    expect(getScheduleRangeDates('week', null, '2026-09-24')).toHaveLength(7);
  });

  // critical-reviewer 지적(Medium): 연 경계(12월)에서도 그 달 1일~말일만 남고 1월 채움
  // 날짜가 섞이지 않아야 한다.
  it('월간이면 인접 달 채움 없이 그 달 1일~말일만(12월=31일, 다음 해 1월 미포함)', () => {
    const dates = getScheduleRangeDates('month', { year: 2026, month: 11 }, null); // 12월
    expect(dates).toHaveLength(31);
    expect(dates[0]).toBe('2026-12-01');
    expect(dates[dates.length - 1]).toBe('2026-12-31');
    expect(dates.every((d) => d.startsWith('2026-12'))).toBe(true);
  });
});
