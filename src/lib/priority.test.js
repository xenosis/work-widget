import { describe, it, expect } from 'vitest';
import { priorityRank, compareByDueDateThenPriority, priorityClassName } from './priority.js';

describe('priorityRank', () => {
  it('상/중/하를 0/1/2로 매핑한다', () => {
    expect(priorityRank('상')).toBe(0);
    expect(priorityRank('중')).toBe(1);
    expect(priorityRank('하')).toBe(2);
  });

  it('알 수 없는 값은 맨 뒤(3)로 보낸다', () => {
    expect(priorityRank('오타')).toBe(3);
    expect(priorityRank(undefined)).toBe(3);
    expect(priorityRank(null)).toBe(3);
  });

  it('프로토타입 체인의 값("constructor" 등)에 낚이지 않는다', () => {
    expect(priorityRank('constructor')).toBe(3);
    expect(priorityRank('toString')).toBe(3);
  });
});

describe('compareByDueDateThenPriority', () => {
  it('마감일이 다르면 이른 날짜가 먼저', () => {
    const a = { due_date: '2026-09-18', priority: '하' };
    const b = { due_date: '2026-09-17', priority: '상' };
    expect(compareByDueDateThenPriority(a, b)).toBeGreaterThan(0);
  });

  it('마감일이 같으면 우선순위 순', () => {
    const high = { due_date: '2026-09-17', priority: '상' };
    const low = { due_date: '2026-09-17', priority: '하' };
    expect(compareByDueDateThenPriority(high, low)).toBeLessThan(0);
  });

  it('마감일 없는 항목은 맨 뒤로 — null/undefined를 같은 값으로 취급해 비교자가 대칭이다', () => {
    const withDate = { due_date: '2026-09-17', priority: '하' };
    const nullDate = { due_date: null, priority: '상' };
    const undefinedDate = { due_date: undefined, priority: '상' };

    expect(compareByDueDateThenPriority(withDate, nullDate)).toBeLessThan(0);
    expect(compareByDueDateThenPriority(nullDate, withDate)).toBeGreaterThan(0);
    // 비대칭 버그였다면 아래 둘 다 양수가 나왔을 것 — null과 undefined를 같은 "없음"으로 보고
    // 우선순위(상==상)만 비교하므로 0이어야 한다.
    expect(compareByDueDateThenPriority(nullDate, undefinedDate)).toBe(0);
    expect(compareByDueDateThenPriority(undefinedDate, nullDate)).toBe(0);
  });
});

describe('priorityClassName', () => {
  it('상/중/하를 high/mid/low로 매핑한다', () => {
    expect(priorityClassName('상')).toBe('high');
    expect(priorityClassName('중')).toBe('mid');
    expect(priorityClassName('하')).toBe('low');
  });

  it('알 수 없는 값은 low로 처리한다', () => {
    expect(priorityClassName('오타')).toBe('low');
    expect(priorityClassName(undefined)).toBe('low');
  });
});
