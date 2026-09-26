import { describe, it, expect } from 'vitest';
import { createScheduleCategory } from './scheduleCategoryFactory.js';

const NOW = '2026-09-26T00:00:00.000Z';

describe('createScheduleCategory', () => {
  it('스키마 필드를 정확히 채운다', () => {
    const c = createScheduleCategory({ name: '업무', color: 'blue' }, NOW);
    expect(c).toMatchObject({ name: '업무', color: 'blue', created_at: NOW, updated_at: NOW });
    expect(c.id).toMatch(/^category-/);
  });

  it('팔레트 밖의 color는 gray로 정규화한다', () => {
    const c = createScheduleCategory({ name: '이상값', color: 'mint' }, NOW);
    expect(c.color).toBe('gray');
  });
});
