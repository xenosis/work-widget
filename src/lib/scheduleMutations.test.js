import { describe, it, expect } from 'vitest';
import { applyScheduleUpdate, removeSchedule } from './scheduleMutations.js';

const NOW = '2026-09-24T00:00:00.000Z';

function schedule(overrides = {}) {
  return {
    id: 'schedule-1',
    title: '회의',
    date: '2026-10-01',
    is_recurring: false,
    recurrence_days: null,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('applyScheduleUpdate', () => {
  it('대상 일정에 업데이트를 병합하고 updated_at을 갱신한다', () => {
    const next = applyScheduleUpdate([schedule()], 'schedule-1', { title: '새 회의' }, NOW);
    expect(next[0]).toMatchObject({ id: 'schedule-1', title: '새 회의', updated_at: NOW });
  });

  it('반복 규칙(recurrence_days)을 바꾸면 그 필드만 갱신된다 — 회차별 레코드가 없어 이후 모든 회차에 자동 반영됨', () => {
    const recurring = schedule({ is_recurring: true, recurrence_days: ['화'] });
    const next = applyScheduleUpdate([recurring], 'schedule-1', { recurrence_days: ['화', '목'] }, NOW);
    expect(next[0].recurrence_days).toEqual(['화', '목']);
  });

  it('대상이 아닌 레코드는 그대로 둔다', () => {
    const other = schedule({ id: 'schedule-2' });
    const next = applyScheduleUpdate([schedule(), other], 'schedule-1', { title: 'x' }, NOW);
    expect(next[1]).toBe(other);
  });

  it('배열 안 null 원소는 안전하게 건너뛴다', () => {
    const next = applyScheduleUpdate([null, schedule()], 'schedule-1', { title: 'y' }, NOW);
    expect(next[0]).toBeNull();
    expect(next[1].title).toBe('y');
  });
});

describe('removeSchedule', () => {
  it('대상 id를 제거한다 — 반복 일정이면 회차별 레코드가 없어 이후 모든 회차가 함께 사라짐', () => {
    const next = removeSchedule([schedule(), schedule({ id: 'schedule-2' })], 'schedule-1');
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe('schedule-2');
  });

  it('배열 안 null 원소가 있어도 죽지 않는다', () => {
    const next = removeSchedule([null, schedule()], 'schedule-none');
    expect(next).toEqual([null, schedule()]);
  });
});
