import { describe, it, expect } from 'vitest';
import {
  applyCategoryUpdate,
  removeCategory,
  unassignCategoryFromSchedules,
  getUsableCategories,
  resolveSubmittableCategoryId,
} from './scheduleCategoryMutations.js';

const NOW = '2026-09-26T00:00:00.000Z';

function category(overrides = {}) {
  return {
    id: 'category-1',
    name: '업무',
    color: 'blue',
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('applyCategoryUpdate', () => {
  it('대상 카테고리에 업데이트를 병합하고 updated_at을 갱신한다', () => {
    const next = applyCategoryUpdate([category()], 'category-1', { name: '새 이름' }, NOW);
    expect(next[0]).toMatchObject({ id: 'category-1', name: '새 이름', updated_at: NOW });
  });

  it('color를 바꾸면 팔레트 밖 값이어도 정규화된다', () => {
    const next = applyCategoryUpdate([category()], 'category-1', { color: 'mint' }, NOW);
    expect(next[0].color).toBe('gray');
  });

  it('color를 안 바꾸면 기존 값을 그대로 둔다', () => {
    const next = applyCategoryUpdate([category()], 'category-1', { name: 'x' }, NOW);
    expect(next[0].color).toBe('blue');
  });

  it('대상이 아닌 레코드는 그대로 둔다', () => {
    const other = category({ id: 'category-2' });
    const next = applyCategoryUpdate([category(), other], 'category-1', { name: 'x' }, NOW);
    expect(next[1]).toBe(other);
  });
});

describe('removeCategory', () => {
  it('대상 id를 제거한다', () => {
    const next = removeCategory([category(), category({ id: 'category-2' })], 'category-1');
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe('category-2');
  });
});

describe('unassignCategoryFromSchedules', () => {
  it('그 카테고리를 쓰던 일정만 category_id를 null로 되돌린다', () => {
    const schedules = [
      { id: 's1', category_id: 'category-1', updated_at: 'old' },
      { id: 's2', category_id: 'category-2', updated_at: 'old' },
    ];
    const next = unassignCategoryFromSchedules(schedules, 'category-1', NOW);
    expect(next[0]).toMatchObject({ category_id: null, updated_at: NOW });
    expect(next[1]).toMatchObject({ category_id: 'category-2', updated_at: 'old' });
  });

  it('배열 안 null 원소는 안전하게 건너뛴다', () => {
    const next = unassignCategoryFromSchedules([null, { id: 's1', category_id: 'category-1' }], 'category-1', NOW);
    expect(next[0]).toBeNull();
  });
});

describe('getUsableCategories', () => {
  it('id 없는 레코드(수기 편집된 data.json 등)를 걸러낸다', () => {
    const next = getUsableCategories([category(), { name: 'id 없음', color: 'blue' }, null]);
    expect(next).toEqual([category()]);
  });
});

describe('resolveSubmittableCategoryId', () => {
  // critical-reviewer 지적(P12.17 리뷰, High): 폼이 열린 채로 그 카테고리가 삭제되면
  // categoryId state가 고아 id로 남는다 — 제출 직전 항상 유효성을 재검증해야 한다.
  it('현재 유효한 카테고리 id면 그대로 돌려준다', () => {
    expect(resolveSubmittableCategoryId('category-1', [category()])).toBe('category-1');
  });

  it('빈 문자열(미분류 선택)이면 null을 돌려준다', () => {
    expect(resolveSubmittableCategoryId('', [category()])).toBeNull();
  });

  it('더 이상 존재하지 않는(삭제된) 카테고리 id면 null을 돌려준다', () => {
    expect(resolveSubmittableCategoryId('category-deleted', [category()])).toBeNull();
  });

  it('id 없는 레코드는 유효한 카테고리로 치지 않는다', () => {
    expect(resolveSubmittableCategoryId('category-1', [{ name: 'id 없음' }, null])).toBeNull();
  });
});
