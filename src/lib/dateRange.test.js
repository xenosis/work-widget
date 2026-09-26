import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  formatLocalDate,
  getTodayDateString,
  getThisWeekRange,
  isThisWeekExcludingToday,
  isValidDateString,
} from './dateRange.js';

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
    ['일요일', 2026, 9, 13],
    ['월요일', 2026, 9, 14],
    ['화요일', 2026, 9, 15],
    ['수요일', 2026, 9, 16],
    ['목요일', 2026, 9, 17],
    ['금요일', 2026, 9, 18],
    ['토요일', 2026, 9, 19],
  ])('%s이어도 같은 주(2026-09-13~09-19)를 반환한다', (_label, y, m, d) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(y, m - 1, d));
    expect(getThisWeekRange()).toEqual({ weekStart: '2026-09-13', weekEnd: '2026-09-19' });
  });

  it('연/월 경계를 넘어도 정확하다(2027-01-02 토요일 -> 2026-12-27~2027-01-02)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2027, 0, 2));
    expect(getThisWeekRange()).toEqual({ weekStart: '2026-12-27', weekEnd: '2027-01-02' });
  });
});

describe('isThisWeekExcludingToday (시스템 시각 2026-09-16 수요일 고정 — 이번주는 09-13~09-19)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('경계값(주 시작/끝)은 포함, 경계 밖(하루 전/후)은 제외한다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 16));
    expect(isThisWeekExcludingToday('2026-09-13')).toBe(true); // weekStart
    expect(isThisWeekExcludingToday('2026-09-19')).toBe(true); // weekEnd
    expect(isThisWeekExcludingToday('2026-09-12')).toBe(false); // 하루 전
    expect(isThisWeekExcludingToday('2026-09-20')).toBe(false); // 하루 후
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

  it('0패딩 없는/빈 문자열 등 YYYY-MM-DD 형식이 아니면 false(사전순 비교로 이번주에 잘못 걸리지 않음)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 16));
    expect(isThisWeekExcludingToday('2026-9-18')).toBe(false); // 0패딩 없음 — 사전순으로는 범위 안
    expect(isThisWeekExcludingToday('')).toBe(false);
    expect(isThisWeekExcludingToday('2026-09-16T00:00:00.000Z')).toBe(false); // 시각 포함 ISO
  });

  it('today/weekRange를 인자로 주입하면 매번 새로 계산하지 않고 그 값을 그대로 쓴다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 16)); // 실제 오늘은 09-16이지만
    // 주입한 today(09-19)를 기준으로 판정해야 하므로, 09-16은 "이번주이면서 오늘 아님"이 된다.
    expect(isThisWeekExcludingToday('2026-09-16', '2026-09-19', { weekStart: '2026-09-14', weekEnd: '2026-09-20' })).toBe(true);
  });
});

describe('isValidDateString', () => {
  it('형태와 실존 날짜가 모두 맞으면 true, 형태가 아니면 false', () => {
    expect(isValidDateString('2026-09-26')).toBe(true);
    expect(isValidDateString('2026-9-5')).toBe(false); // 0패딩 없음
    expect(isValidDateString('')).toBe(false);
    expect(isValidDateString(null)).toBe(false);
    expect(isValidDateString(undefined)).toBe(false);
    expect(isValidDateString(20260901)).toBe(false); // 문자열 아님(손상 데이터)
  });

  it('형태는 맞지만 실제로 없는 날짜는 왕복 검증으로 걸러낸다', () => {
    expect(isValidDateString('2026-13-45')).toBe(false); // 존재하지 않는 월/일
    expect(isValidDateString('2026-02-30')).toBe(false); // 2월엔 30일이 없음
    expect(isValidDateString('2026-04-31')).toBe(false); // 4월엔 31일이 없음
  });

  it('윤년 2월 29일은 윤년에서만 true', () => {
    expect(isValidDateString('2028-02-29')).toBe(true); // 2028은 윤년
    expect(isValidDateString('2026-02-29')).toBe(false); // 2026은 윤년 아님
  });
});
