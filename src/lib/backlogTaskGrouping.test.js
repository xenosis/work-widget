import { describe, it, expect } from 'vitest';
import { groupTasksByStatus } from './backlogTaskGrouping.js';

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
