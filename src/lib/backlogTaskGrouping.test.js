import { describe, it, expect } from 'vitest';
import { groupTasksByStatus, selectGroupDisplayTasks } from './backlogTaskGrouping.js';

function task(overrides = {}) {
  return { id: 't1', title: 'A', status: 'todo', owner: null, ...overrides };
}

describe('groupTasksByStatus', () => {
  it('빈 목록이면 빈 그룹 목록을 돌려준다', () => {
    expect(groupTasksByStatus([])).toEqual([]);
  });

  it('같은 status끼리 하나의 그룹으로 묶는다', () => {
    const tasks = [task({ id: 't1', status: 'todo' }), task({ id: 't2', status: 'todo' }), task({ id: 't3', status: 'done' })];
    const groups = groupTasksByStatus(tasks);
    expect(groups).toEqual([
      { status: 'todo', tasks: [tasks[0], tasks[1]] },
      { status: 'done', tasks: [tasks[2]] },
    ]);
  });

  it('그룹 순서는 task 배열에 처음 등장한 순서를 따른다', () => {
    const tasks = [task({ id: 't1', status: 'done' }), task({ id: 't2', status: 'todo' }), task({ id: 't3', status: 'done' })];
    const groups = groupTasksByStatus(tasks);
    expect(groups.map((g) => g.status)).toEqual(['done', 'todo']);
  });

  it('이 프로젝트가 모르는 임의의 status 문자열도 그대로 그룹 키가 된다', () => {
    const tasks = [task({ status: '블록됨' })];
    expect(groupTasksByStatus(tasks)).toEqual([{ status: '블록됨', tasks }]);
  });

  // critical-reviewer 지적(P14.2 리뷰, High): "상태/담당자 기준으로 나열"에서 담당자 축이
  // 구조에 전혀 반영되지 않았었다 — 각 상태 그룹 안에서 담당자로 안정 정렬하도록 고쳤다.
  it('같은 상태 그룹 안에서는 담당자 이름 순으로 정렬된다(담당자 없음은 뒤로)', () => {
    const tasks = [
      task({ id: 't1', status: 'todo', owner: null }),
      task({ id: 't2', status: 'todo', owner: '홍길동' }),
      task({ id: 't3', status: 'todo', owner: '김철수' }),
    ];
    const groups = groupTasksByStatus(tasks);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(['t3', 't2', 't1']);
  });

  it('같은 담당자를 가진 task끼리는 원래(배열) 순서를 유지한다(안정 정렬)', () => {
    const tasks = [
      task({ id: 't1', status: 'todo', owner: '홍길동' }),
      task({ id: 't2', status: 'todo', owner: '홍길동' }),
      task({ id: 't3', status: 'todo', owner: '홍길동' }),
    ];
    const groups = groupTasksByStatus(tasks);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(['t1', 't2', 't3']);
  });

  it('담당자 정렬은 그룹 경계를 넘지 않는다(상태가 먼저 나뉜다)', () => {
    const tasks = [
      task({ id: 't1', status: 'done', owner: '홍길동' }),
      task({ id: 't2', status: 'todo', owner: '가나다' }),
    ];
    const groups = groupTasksByStatus(tasks);
    expect(groups.map((g) => g.status)).toEqual(['done', 'todo']);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(['t1']);
    expect(groups[1].tasks.map((t) => t.id)).toEqual(['t2']);
  });
});

describe('selectGroupDisplayTasks', () => {
  it('cap을 넘지 않으면 전부 그대로 보여준다', () => {
    const tasks = [task({ id: 't1' }), task({ id: 't2' })];
    expect(selectGroupDisplayTasks(tasks, new Set(), 50)).toEqual({ displayed: tasks, hiddenCount: 0 });
  });

  it('안 바뀐 항목만 cap을 적용하고, 바뀐 항목은 cap 밖에 있어도 항상 포함한다', () => {
    const tasks = [
      task({ id: 't1' }),
      task({ id: 't2' }),
      task({ id: 't3' }), // 바뀐 항목 — cap(1)을 넘는 3번째 자리에 있어도 항상 보여야 함
    ];
    const result = selectGroupDisplayTasks(tasks, new Set(['t3']), 1);
    expect(result.displayed.map((t) => t.id)).toEqual(['t1', 't3']); // 안 바뀐 것 중 1개 + 바뀐 것
    expect(result.hiddenCount).toBe(1); // t2만 잘림
  });

  it('원래 배열 순서를 유지한다(바뀐 항목을 앞으로 끌어올리지 않음)', () => {
    const tasks = [task({ id: 't1' }), task({ id: 't2' }), task({ id: 't3' })];
    const result = selectGroupDisplayTasks(tasks, new Set(['t1', 't3']), 50);
    expect(result.displayed.map((t) => t.id)).toEqual(['t1', 't2', 't3']);
  });

  // critical-reviewer 지적(Medium): 위 순서 유지 테스트는 cap이 실제로 걸리지 않는 조건이라
  // "안 바뀐 항목 사이에 바뀐 항목이 끼어 있을 때도 순서가 유지되는지"를 검증하지 못했다.
  it('cap이 실제로 걸려도, 바뀐 항목이 안 바뀐 항목들 사이에 끼어 있으면 그 자리 그대로 유지된다', () => {
    const tasks = [
      task({ id: 'u1' }),
      task({ id: 'c1' }), // 바뀐 항목
      task({ id: 'u2' }),
      task({ id: 'u3' }),
      task({ id: 'c2' }), // 바뀐 항목
    ];
    const result = selectGroupDisplayTasks(tasks, new Set(['c1', 'c2']), 1); // 안 바뀐 것 중 1개만
    expect(result.displayed.map((t) => t.id)).toEqual(['u1', 'c1', 'c2']); // u2/u3는 cap 밖
    expect(result.hiddenCount).toBe(2);
  });

  // critical-reviewer 지적(High): 외부 파일은 id 중복이 없다는 보장이 없다 — 처음 구현은
  // "안 바뀐 것 중 cap개"를 id Set으로 만들어 다시 필터링해서, 같은 id가 여러 번 나오면
  // cap이 새거나(중복 id 행이 cap보다 많이 렌더됨) hiddenCount가 부풀려졌다. 위치 기반
  // 판단(한 번의 순회로 그 자리에서 바로 결정)으로 고쳐 이 문제를 없앴다.
  it('안 바뀐 항목끼리 id가 중복돼도 cap을 정확히 지키고 hiddenCount도 정확하다', () => {
    const tasks = [task({ id: 'dup' }), task({ id: 'dup' }), task({ id: 'y' })];
    const result = selectGroupDisplayTasks(tasks, new Set(), 2); // cap=2
    expect(result.displayed).toHaveLength(2); // dup 1개 + dup 1개(같은 id, 다른 행) = 정확히 2개
    expect(result.hiddenCount).toBe(1); // y만 잘림
  });
});
