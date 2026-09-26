// P12.9: getScheduleCellSummary/buildScheduleCellTooltip 전용 테스트 파일 — scheduleGrid.test.js가
// 이미 eslint max-lines(300) 한도에 근접해 있어(P12.19 때도 같은 이유로 조건을 줄여 합쳤음)
// 새 케이스를 그 파일에 더 넣는 대신 별도 파일로 분리했다.
// P12.17: 점이 "반복/일회성" 대신 카테고리 색을 담게 되면서(사용자가 참고로 든 routine-planner의
// 캘린더 방식) 시그니처에 categories가 추가됐다 — 전체 케이스를 새 계약(dots: {color,
// isRecurring})에 맞게 다시 썼다.
import { describe, it, expect } from 'vitest';
import { getScheduleCellSummary, buildScheduleCellTooltip, getScheduleDotClassName } from './scheduleGrid.js';

const CATEGORIES = [
  { id: 'c-work', name: '업무', color: 'blue' },
  { id: 'c-personal', name: '개인', color: 'green' },
];

describe('getScheduleCellSummary', () => {
  it('일정이 없으면 count 0에 빈 목록을 돌려준다', () => {
    expect(getScheduleCellSummary([], '2026-09-26', CATEGORIES)).toEqual({
      count: 0,
      dots: [],
      overflowCount: 0,
      titles: [],
    });
  });

  it('반복+일회성, 카테고리 있음/없음이 섞이면 각 점에 색과 반복 여부가 함께 담긴다', () => {
    const schedules = [
      { id: 's1', date: '2026-09-20', is_recurring: true, recurrence_days: ['토'], title: '주간 회의', category_id: 'c-work' },
      { id: 's2', date: '2026-09-26', is_recurring: false, title: '병원 예약', category_id: null },
    ];
    const summary = getScheduleCellSummary(schedules, '2026-09-26', CATEGORIES);
    expect(summary.count).toBe(2);
    expect(summary.dots).toEqual([
      { color: 'blue', isRecurring: true },
      { color: null, isRecurring: false },
    ]);
    expect(summary.overflowCount).toBe(0);
    expect(summary.titles).toEqual(['주간 회의', '병원 예약']);
  });

  it('maxDots를 넘으면 초과분은 점 대신 overflowCount로 뭉친다', () => {
    const schedules = ['a', 'b', 'c', 'd', 'e'].map((id, i) => ({
      id,
      date: '2026-09-26',
      is_recurring: false,
      title: `일정${i}`,
    }));
    const summary = getScheduleCellSummary(schedules, '2026-09-26', CATEGORIES, 3);
    expect(summary.count).toBe(5);
    expect(summary.dots).toHaveLength(3);
    expect(summary.overflowCount).toBe(2);
    // 점으로 안 보이는 나머지도 titles(툴팁용)에는 전부 포함된다.
    expect(summary.titles).toHaveLength(5);
  });

  it('title이 없거나 빈 문자열이면 (제목 없음)으로 채운다', () => {
    const schedules = [
      { id: 's1', date: '2026-09-26', is_recurring: false, title: '' },
      { id: 's2', date: '2026-09-26', is_recurring: false },
    ];
    expect(getScheduleCellSummary(schedules, '2026-09-26', CATEGORIES).titles).toEqual(['(제목 없음)', '(제목 없음)']);
  });

  it('일정 개수가 정확히 maxDots개면 overflowCount는 0이다(경계값)', () => {
    const schedules = ['a', 'b', 'c'].map((id) => ({ id, date: '2026-09-26', is_recurring: false, title: id }));
    const summary = getScheduleCellSummary(schedules, '2026-09-26', CATEGORIES, 3);
    expect(summary.dots).toHaveLength(3);
    expect(summary.overflowCount).toBe(0);
  });

  it('is_recurring이 boolean이 아니면(문자열 "true" 등) isRecurring:false로 분류한다', () => {
    const schedules = [{ id: 's1', date: '2026-09-26', is_recurring: 'true', title: '일정' }];
    expect(getScheduleCellSummary(schedules, '2026-09-26', CATEGORIES).dots).toEqual([
      { color: null, isRecurring: false },
    ]);
  });

  it('점 순서는 반복 여부와 무관하게 매칭된 순서 그대로다', () => {
    const schedules = [
      { id: 's1', date: '2026-09-26', is_recurring: false, title: '일회성' },
      { id: 's2', date: '2026-09-20', is_recurring: true, recurrence_days: ['토'], title: '반복' },
    ];
    expect(getScheduleCellSummary(schedules, '2026-09-26', CATEGORIES).dots).toEqual([
      { color: null, isRecurring: false },
      { color: null, isRecurring: true },
    ]);
  });

  // P12.17: category_id가 이미 삭제된 카테고리를 가리키는 고아 참조 — critical-reviewer
  // 지적(High)으로, 폼이 열린 채로 그 카테고리가 삭제되는 정상 사용 흐름에서도 생길 수
  // 있음이 확인됐다(수기 편집 전용이 아님, resolveSubmittableCategoryId로 제출 시점에
  // 방지하도록 수정 — scheduleCategoryMutations.js 참고). 여기서는 그래도 고아가 남아있을
  // 경우 렌더가 안전한지(색이 null로 처리되는지)만 방어적으로 확인.
  it('category_id가 존재하지 않는 카테고리를 가리키면(고아 참조) color가 null이다', () => {
    const schedules = [{ id: 's1', date: '2026-09-26', is_recurring: false, title: '일정', category_id: '없는-id' }];
    expect(getScheduleCellSummary(schedules, '2026-09-26', CATEGORIES).dots).toEqual([
      { color: null, isRecurring: false },
    ]);
  });
});

describe('getScheduleDotClassName', () => {
  // critical-reviewer 지적(P12.17 리뷰, Medium): 월간/주간 뷰가 공유하는 공용 함수인데
  // vitest 케이스가 하나도 없었다 — 4가지 조합(색 있음/없음 × 반복/비반복)을 고정한다.
  it('카테고리 색이 있고 비반복이면 is-{color}만 붙는다', () => {
    expect(getScheduleDotClassName({ color: 'blue', isRecurring: false })).toBe('schedule-day-dot is-blue');
  });

  it('카테고리 색이 있고 반복이면 is-{color}와 is-recurring-ring이 함께 붙는다', () => {
    expect(getScheduleDotClassName({ color: 'blue', isRecurring: true })).toBe(
      'schedule-day-dot is-blue is-recurring-ring'
    );
  });

  it('색이 null(미분류)이고 비반복이면 is-none만 붙는다', () => {
    expect(getScheduleDotClassName({ color: null, isRecurring: false })).toBe('schedule-day-dot is-none');
  });

  it('색이 null(미분류)이고 반복이면 is-none과 is-recurring-ring이 함께 붙는다', () => {
    expect(getScheduleDotClassName({ color: null, isRecurring: true })).toBe(
      'schedule-day-dot is-none is-recurring-ring'
    );
  });
});

describe('buildScheduleCellTooltip', () => {
  it('공휴일 이름과 일정 제목을 가운뎃점으로 합친다', () => {
    expect(buildScheduleCellTooltip('개천절', ['주간 회의', '병원 예약'])).toBe('개천절 · 주간 회의, 병원 예약');
  });

  it('한쪽만 있으면 그것만 반환한다', () => {
    expect(buildScheduleCellTooltip('개천절', [])).toBe('개천절');
    expect(buildScheduleCellTooltip(null, ['주간 회의'])).toBe('주간 회의');
  });

  it('둘 다 없으면 undefined(title 속성 자체를 안 그림)', () => {
    expect(buildScheduleCellTooltip(null, [])).toBeUndefined();
    expect(buildScheduleCellTooltip(undefined, [])).toBeUndefined();
  });
});
