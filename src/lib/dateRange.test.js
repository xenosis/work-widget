import { describe, it, expect, afterEach, vi } from 'vitest';
import { formatLocalDate, getTodayDateString, getThisWeekRange, isThisWeekExcludingToday } from './dateRange.js';

describe('formatLocalDate', () => {
  it('YYYY-MM-DD로 포맷한다(월/일 0패딩)', () => {
    expect(formatLocalDate(new Date(2026, 8, 16))).toBe('2026-09-16');
    expect(formatLocalDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('getTodayDateString / getThisWeekRange (시스템 시각 고정)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('수요일 — getTodayDateString이 오늘 날짜를 돌려준다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 16)); // 2026-09-16 수
    expect(getTodayDateString()).toBe('2026-09-16');
  });

  it.each([
    ['월요일', 2026, 9, 14],
    ['화요일', 2026, 9, 15],
    ['수요일', 2026, 9, 16],
    ['목요일', 2026, 9, 17],
    ['금요일', 2026, 9, 18],
    ['토요일', 2026, 9, 19],
    ['일요일', 2026, 9, 20],
  ])('%s이어도 같은 주(2026-09-14~09-20)를 반환한다', (_label, y, m, d) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(y, m - 1, d));
    expect(getThisWeekRange()).toEqual({ weekStart: '2026-09-14', weekEnd: '2026-09-20' });
  });

  it('연/월 경계를 넘어도 정확하다(2027-01-02 토요일 -> 2026-12-28~2027-01-03)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2027, 0, 2));
    expect(getThisWeekRange()).toEqual({ weekStart: '2026-12-28', weekEnd: '2027-01-03' });
  });
});

describe('isThisWeekExcludingToday (시스템 시각 2026-09-16 수요일 고정 — 이번주는 09-14~09-20)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('경계값(주 시작/끝)은 포함, 경계 밖(하루 전/후)은 제외한다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 16));
    expect(isThisWeekExcludingToday('2026-09-14')).toBe(true); // weekStart
    expect(isThisWeekExcludingToday('2026-09-20')).toBe(true); // weekEnd
    expect(isThisWeekExcludingToday('2026-09-13')).toBe(false); // 하루 전
    expect(isThisWeekExcludingToday('2026-09-21')).toBe(false); // 하루 후
  });

  it('오늘 날짜는 이번주 범위 안이어도 제외한다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 16));
    expect(isThisWeekExcludingToday('2026-09-16')).toBe(false);
  });

  it('문자열이 아닌 값(null/undefined)은 false', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 16));
    expect(isThisWeekExcludingToday(null)).toBe(false);
    expect(isThisWeekExcludingToday(undefined)).toBe(false);
  });
});
