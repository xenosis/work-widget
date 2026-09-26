import { describe, it, expect } from 'vitest';
import { createSchedule } from './scheduleFactory.js';

const NOW = '2026-09-24T00:00:00.000Z';

describe('createSchedule', () => {
  it('일회성 일정은 recurrence_days를 null로 둔다', () => {
    const s = createSchedule({ title: '회의', date: '2026-10-01', isRecurring: false, recurrenceDays: [] }, NOW);
    expect(s).toMatchObject({
      title: '회의',
      date: '2026-10-01',
      is_recurring: false,
      recurrence_days: null,
      created_at: NOW,
      updated_at: NOW,
    });
    expect(s.id).toMatch(/^schedule-/);
  });

  it('반복 일정은 recurrence_days를 그대로 저장한다', () => {
    const s = createSchedule(
      { title: '주간회의', date: '2026-10-01', isRecurring: true, recurrenceDays: ['화', '목'] },
      NOW
    );
    expect(s.is_recurring).toBe(true);
    expect(s.recurrence_days).toEqual(['화', '목']);
  });

  // P12.16(critical-reviewer 지적): category_id를 이 함수가 안 채우면 dataStore.js의 정규화
  // 전까지 필드 자체가 없는 상태로 저장된다 — categoryId를 안 넘기면 null(미분류)로 채워지는지 고정.
  it('categoryId를 안 넘기면 category_id는 null(미분류)이다', () => {
    const s = createSchedule({ title: '회의', date: '2026-10-01', isRecurring: false, recurrenceDays: [] }, NOW);
    expect(s.category_id).toBeNull();
  });

  // P12.17: ScheduleAddForm.jsx가 실제로 categoryId를 넘겨주게 됐다 — 그대로 저장되는지 확인.
  it('categoryId를 넘기면 category_id에 그대로 저장된다', () => {
    const s = createSchedule(
      { title: '회의', date: '2026-10-01', isRecurring: false, recurrenceDays: [], categoryId: 'category-1' },
      NOW
    );
    expect(s.category_id).toBe('category-1');
  });
});
