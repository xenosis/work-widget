import { describe, it, expect } from 'vitest';
import { CATEGORY_PALETTE, normalizeCategoryColor, resolveCategoryColor, resolveCategoryName } from './categoryPalette.js';

describe('CATEGORY_PALETTE', () => {
  it('7개의 고유한 key를 가진 고정 팔레트다', () => {
    expect(CATEGORY_PALETTE).toHaveLength(7);
    const keys = CATEGORY_PALETTE.map((c) => c.key);
    expect(new Set(keys).size).toBe(7);
  });
});

describe('normalizeCategoryColor', () => {
  it('팔레트 안의 key는 그대로 돌려준다', () => {
    expect(normalizeCategoryColor('blue')).toBe('blue');
  });

  it('팔레트 밖의 값/손상된 값은 gray로 폴백한다', () => {
    expect(normalizeCategoryColor('mint')).toBe('gray');
    expect(normalizeCategoryColor('')).toBe('gray');
    expect(normalizeCategoryColor(null)).toBe('gray');
    expect(normalizeCategoryColor(undefined)).toBe('gray');
    expect(normalizeCategoryColor(123)).toBe('gray');
  });
});

describe('resolveCategoryColor/resolveCategoryName', () => {
  const categories = [{ id: 'c1', name: '업무', color: 'blue' }];

  it('존재하는 category_id면 정규화된 색/이름을 돌려준다', () => {
    expect(resolveCategoryColor('c1', categories)).toBe('blue');
    expect(resolveCategoryName('c1', categories)).toBe('업무');
  });

  it('category_id가 null/undefined(미분류)면 둘 다 null이다', () => {
    expect(resolveCategoryColor(null, categories)).toBeNull();
    expect(resolveCategoryName(undefined, categories)).toBeNull();
  });

  it('category_id가 있지만 그 카테고리가 이미 삭제된 경우(고아 참조)도 null로 취급한다', () => {
    expect(resolveCategoryColor('없는-id', categories)).toBeNull();
    expect(resolveCategoryName('없는-id', categories)).toBeNull();
  });

  it('찾은 카테고리의 color가 팔레트 밖이면 정규화해서 돌려준다', () => {
    const damaged = [{ id: 'c2', name: '손상', color: 'mint' }];
    expect(resolveCategoryColor('c2', damaged)).toBe('gray');
  });
});
