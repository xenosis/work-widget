import { describe, it, expect } from 'vitest';
import { applyMemoUpdate, removeMemo } from './memoMutations.js';

const NOW = '2026-09-18T00:00:00.000Z';

function memo(overrides = {}) {
  return {
    id: 'memo-1',
    project_id: null,
    title: '제목',
    content: '내용',
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('applyMemoUpdate', () => {
  it('전달된 필드를 병합하고 updated_at을 갱신한다', () => {
    const next = applyMemoUpdate([memo()], 'memo-1', { title: '새 제목', content: '새 내용' }, NOW);
    expect(next[0]).toMatchObject({ title: '새 제목', content: '새 내용', updated_at: NOW });
  });

  it('대상이 아닌 레코드는 그대로 둔다', () => {
    const other = memo({ id: 'memo-2' });
    const next = applyMemoUpdate([memo(), other], 'memo-1', { title: 'x' }, NOW);
    expect(next[1]).toBe(other);
  });

  it('null 원소는 안전하게 건너뛴다', () => {
    const next = applyMemoUpdate([null, memo()], 'memo-1', { title: 'x' }, NOW);
    expect(next[0]).toBeNull();
  });

  it('memos가 배열이 아니면 빈 배열을 반환한다', () => {
    expect(applyMemoUpdate(undefined, 'memo-1', { title: 'x' }, NOW)).toEqual([]);
  });

  it('updates에 id/created_at이 실려 와도 원본 값으로 고정한다', () => {
    const next = applyMemoUpdate([memo()], 'memo-1', { id: 'hacked', created_at: 'bogus', title: 'x' }, NOW);
    expect(next[0]).toMatchObject({ id: 'memo-1', created_at: '2026-09-01T00:00:00.000Z' });
  });
});

describe('removeMemo', () => {
  it('대상 id를 제거한다', () => {
    const next = removeMemo([memo(), memo({ id: 'memo-2' })], 'memo-1');
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe('memo-2');
  });

  it('null 원소가 있어도 죽지 않고, id가 안 맞으면 그대로 둔다', () => {
    const next = removeMemo([null, memo()], 'memo-none');
    expect(next).toEqual([null, memo()]);
  });
});
