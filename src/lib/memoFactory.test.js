import { describe, it, expect } from 'vitest';
import { createMemo } from './memoFactory.js';

describe('createMemo', () => {
  it('B3.3 스키마 필드를 전부 채운다', () => {
    const memo = createMemo('2026-09-18T00:00:00.000Z');
    expect(memo).toEqual({
      id: expect.any(String),
      project_id: null,
      title: '',
      content: '',
      created_at: '2026-09-18T00:00:00.000Z',
      updated_at: '2026-09-18T00:00:00.000Z',
    });
  });

  it('id는 memo- 접두어를 가진 고유 문자열이다', () => {
    const a = createMemo();
    const b = createMemo();
    expect(a.id).toMatch(/^memo-/);
    expect(a.id).not.toBe(b.id);
  });
});
