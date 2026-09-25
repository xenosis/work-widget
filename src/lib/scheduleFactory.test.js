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
});
