import { describe, it, expect } from 'vitest';
import { validateSchema, findCycle, findParentCycle, isValidDueDate } from './schema.js';

// P11 critical-reviewer 지적(Critical): findCycle은 deps 그래프만 보고 parent는 안 본다는
// 사실이 주석에만 있고 테스트가 없었다 — findParentCycle을 deps 순환 검사와 나란히 검증해
// 둘이 서로 다른 그래프라는 걸 회귀 테스트로 고정한다.

function task(overrides) {
  return {
    id: 'P1', status: 'todo', priority: 'P1', category: 'feature', title: 't', summary: 's',
    where: null, parent: null, deps: [], doc: null, done_when: 'd', est_min: null, gate: null,
    owner: null, claimed_at: null, updated_at: '2026-01-01T00:00:00.000Z', log: [],
    ...overrides,
  };
}

const enums = { status: ['todo', 'done'], priority: ['P1'], category: ['feature'] };

describe('validateSchema', () => {
  it('정상 구조는 에러가 없다', () => {
    const json = { enums, tasks: [task({ id: 'P1' }), task({ id: 'P2', parent: 'P1' })] };
    expect(validateSchema(json)).toEqual([]);
  });

  it('id 중복을 잡는다', () => {
    const json = { enums, tasks: [task({ id: 'P1' }), task({ id: 'P1' })] };
    expect(validateSchema(json).some((e) => e.includes('id 중복'))).toBe(true);
  });

  it('존재하지 않는 parent 참조를 잡는다', () => {
    const json = { enums, tasks: [task({ id: 'P1', parent: 'P9' })] };
    expect(validateSchema(json).some((e) => e.includes('parent'))).toBe(true);
  });

  // P27 critical-reviewer 지적(Medium): due_date 형식 검증이 addTask/setField(쓰기 경로)에만
  // 있으면, 손 편집이나 다른 도구로 잘못된 값이 들어와도 validate-backlog 훅/list/show가
  // 거치는 이 구조 검증은 조용히 통과시킨다 — 여기서도 확인해야 한다.
  it('잘못된 due_date 값을 잡는다', () => {
    const json = { enums, tasks: [task({ id: 'P1', due_date: '2026-99-99' })] };
    expect(validateSchema(json).some((e) => e.includes('due_date'))).toBe(true);
  });

  it('due_date가 null이거나 키 자체가 없으면 통과한다', () => {
    const withNull = { enums, tasks: [task({ id: 'P1', due_date: null })] };
    expect(validateSchema(withNull)).toEqual([]);
    const withoutKey = task({ id: 'P1' });
    delete withoutKey.due_date;
    expect(validateSchema({ enums, tasks: [withoutKey] })).toEqual([]);
  });
});

describe('findCycle (deps 그래프)', () => {
  it('deps에 순환이 없으면 null', () => {
    const tasks = [task({ id: 'P1', deps: [] }), task({ id: 'P2', deps: ['P1'] })];
    expect(findCycle(tasks)).toBeNull();
  });

  it('deps 순환을 찾는다', () => {
    const tasks = [task({ id: 'P1', deps: ['P2'] }), task({ id: 'P2', deps: ['P1'] })];
    expect(findCycle(tasks)).not.toBeNull();
  });

  it('parent만 순환이고 deps는 정상이면 findCycle은 못 잡는다(별개 그래프)', () => {
    const tasks = [task({ id: 'P1', parent: 'P2', deps: [] }), task({ id: 'P2', parent: 'P1', deps: [] })];
    expect(findCycle(tasks)).toBeNull();
  });
});

describe('findParentCycle', () => {
  it('parent 체인이 트리 구조면 null', () => {
    const tasks = [task({ id: 'P1' }), task({ id: 'P1.1', parent: 'P1' }), task({ id: 'P1.1.1', parent: 'P1.1' })];
    expect(findParentCycle(tasks)).toBeNull();
  });

  it('부모-자식이 서로를 가리키는 순환을 찾는다', () => {
    const tasks = [task({ id: 'P1', parent: 'P2' }), task({ id: 'P2', parent: 'P1' })];
    expect(findParentCycle(tasks)).not.toBeNull();
  });

  it('자기 자신을 parent로 가리키는 것도 순환으로 잡는다', () => {
    const tasks = [task({ id: 'P1', parent: 'P1' })];
    expect(findParentCycle(tasks)).not.toBeNull();
  });

  it('존재하지 않는 parent를 가리키는 건 순환이 아니라 참조 무결성 문제(validateSchema 담당)라 통과시킨다', () => {
    const tasks = [task({ id: 'P1', parent: 'P9' })];
    expect(findParentCycle(tasks)).toBeNull();
  });

  it('deps만 순환이고 parent는 정상이면 findParentCycle은 못 잡는다(별개 그래프)', () => {
    const tasks = [task({ id: 'P1', deps: ['P2'] }), task({ id: 'P2', deps: ['P1'] })];
    expect(findParentCycle(tasks)).toBeNull();
  });
});

// P27: due_date는 선택 필드라 null이 유효값이고, 문자열이면 형태(YYYY-MM-DD)뿐 아니라 실제로
// 존재하는 날짜인지(왕복 검증)까지 확인해야 한다.
describe('isValidDueDate', () => {
  it('null은 유효하다(값 없음 허용)', () => {
    expect(isValidDueDate(null)).toBe(true);
  });

  it('올바른 YYYY-MM-DD 문자열은 유효하다', () => {
    expect(isValidDueDate('2026-09-27')).toBe(true);
  });

  it('형태가 안 맞으면 거부한다', () => {
    expect(isValidDueDate('2026/09/27')).toBe(false);
    expect(isValidDueDate('26-09-27')).toBe(false);
    expect(isValidDueDate('')).toBe(false);
  });

  it('형태는 맞지만 실재하지 않는 날짜는 거부한다(월/일 초과)', () => {
    expect(isValidDueDate('2026-13-01')).toBe(false);
    expect(isValidDueDate('2026-02-30')).toBe(false);
  });

  it('문자열이 아닌 값(undefined, 숫자, boolean)은 거부한다', () => {
    expect(isValidDueDate(undefined)).toBe(false);
    expect(isValidDueDate(20260927)).toBe(false);
    expect(isValidDueDate(true)).toBe(false);
  });
});
