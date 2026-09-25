import { describe, it, expect } from 'vitest';
import { applyTodoCompletion, applyProjectStatusForTodos, applyTodoUpdate, removeTodo } from './todoMutations.js';

const NOW = '2026-09-18T00:00:00.000Z';

function todo(overrides = {}) {
  return {
    id: 't1',
    project_id: null,
    title: '할일',
    completed: false,
    completed_at: null,
    due_date: null,
    priority: '중',
    tags: [],
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('applyTodoCompletion', () => {
  it('완료 체크 시 completed_at을 채우고 updated_at을 갱신한다', () => {
    const next = applyTodoCompletion([todo()], 't1', true, NOW);
    expect(next[0]).toMatchObject({ completed: true, completed_at: NOW, updated_at: NOW });
  });

  it('완료 취소 시 completed_at을 null로 되돌린다', () => {
    const completed = todo({ completed: true, completed_at: '2026-09-10T00:00:00.000Z' });
    const next = applyTodoCompletion([completed], 't1', false, NOW);
    expect(next[0]).toMatchObject({ completed: false, completed_at: null, updated_at: NOW });
  });

  it('대상이 아닌 레코드는 그대로 둔다', () => {
    const other = todo({ id: 't2' });
    const next = applyTodoCompletion([todo(), other], 't1', true, NOW);
    expect(next[1]).toBe(other);
  });

  it('null 원소는 안전하게 건너뛴다', () => {
    const next = applyTodoCompletion([null, todo()], 't1', true, NOW);
    expect(next[0]).toBeNull();
    expect(next[1].completed).toBe(true);
  });
});

describe('applyProjectStatusForTodos', () => {
  const project = { id: 'p1', status: '진행중', updated_at: '2026-09-01T00:00:00.000Z' };

  it('project_id가 없으면(B3.2상 있어야 하는 값이 빠진 예외 데이터) 프로젝트 배열을 건드리지 않는다', () => {
    const projects = [project];
    const next = applyProjectStatusForTodos(projects, null, []);
    expect(next).toBe(projects);
  });

  it('소속 할일이 전부 완료면 프로젝트 상태를 완료로 바꾸고 updated_at을 갱신한다', () => {
    const todos = [todo({ project_id: 'p1', completed: true })];
    const next = applyProjectStatusForTodos([project], 'p1', todos, NOW);
    expect(next[0]).toMatchObject({ status: '완료', updated_at: NOW });
  });

  it('완료 상태였다가 완료 취소되면(더 이상 전부 완료 아님) 진행중으로 되돌리고 updated_at을 갱신한다', () => {
    const completedProject = { id: 'p1', status: '완료', updated_at: '2026-09-01T00:00:00.000Z' };
    const todos = [todo({ project_id: 'p1', completed: false })];
    const next = applyProjectStatusForTodos([completedProject], 'p1', todos, NOW);
    expect(next[0]).toMatchObject({ status: '진행중', updated_at: NOW });
  });

  it('보류 상태는 자동 전환 대상이 아니다', () => {
    const onHoldProject = { id: 'p1', status: '보류' };
    const todos = [todo({ project_id: 'p1', completed: true })];
    const next = applyProjectStatusForTodos([onHoldProject], 'p1', todos);
    expect(next[0].status).toBe('보류');
  });

  it('상태가 실제로 바뀌지 않으면 updated_at을 건드리지 않는다(같은 레코드를 그대로 반환)', () => {
    const todos = [todo({ project_id: 'p1', completed: false })];
    const next = applyProjectStatusForTodos([project], 'p1', todos, NOW);
    expect(next[0]).toBe(project);
  });
});

describe('applyTodoUpdate', () => {
  it('전달된 필드를 병합하고 updated_at을 갱신한다', () => {
    const next = applyTodoUpdate([todo()], 't1', { title: '새 제목', priority: '상' }, NOW);
    expect(next[0]).toMatchObject({ title: '새 제목', priority: '상', updated_at: NOW });
  });

  it('completed/completed_at은 이 함수의 대상이 아니다(그대로 유지)', () => {
    const completed = todo({ completed: true, completed_at: '2026-09-10T00:00:00.000Z' });
    const next = applyTodoUpdate([completed], 't1', { title: 'x' }, NOW);
    expect(next[0]).toMatchObject({ completed: true, completed_at: '2026-09-10T00:00:00.000Z' });
  });

  it('대상이 아닌 레코드는 그대로 둔다', () => {
    const other = todo({ id: 't2' });
    const next = applyTodoUpdate([todo(), other], 't1', { title: 'x' }, NOW);
    expect(next[1]).toBe(other);
  });

  it('null 원소는 안전하게 건너뛴다', () => {
    const next = applyTodoUpdate([null, todo()], 't1', { title: 'x' }, NOW);
    expect(next[0]).toBeNull();
  });
});

describe('removeTodo', () => {
  it('대상 id를 제거한다', () => {
    const next = removeTodo([todo(), todo({ id: 't2' })], 't1');
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe('t2');
  });

  it('null 원소가 있어도 죽지 않고, id가 안 맞으면 그대로 둔다', () => {
    const next = removeTodo([null, todo()], 't-none');
    expect(next).toEqual([null, todo()]);
  });
});
