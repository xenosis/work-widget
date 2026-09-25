import { describe, it, expect } from 'vitest';
import { getTodosForProject } from './projectTodos.js';

describe('getTodosForProject', () => {
  it('project_id가 일치하는 할일만 반환한다', () => {
    const todos = [
      { id: 't1', project_id: 'p1' },
      { id: 't2', project_id: 'p2' },
      { id: 't3', project_id: 'p1' },
    ];
    expect(getTodosForProject(todos, 'p1').todos.map((t) => t.id)).toEqual(['t1', 't3']);
  });

  it('id 없는 할일은 목록에서 제외하고 droppedCount에 반영한다', () => {
    const todos = [{ project_id: 'p1', title: 'id 없음' }, { id: 't1', project_id: 'p1' }];
    const result = getTodosForProject(todos, 'p1');
    expect(result.todos.map((t) => t.id)).toEqual(['t1']);
    expect(result.droppedCount).toBe(1);
  });

  it('id 있는 할일만 있으면 droppedCount는 0이다', () => {
    const todos = [{ id: 't1', project_id: 'p1' }];
    expect(getTodosForProject(todos, 'p1').droppedCount).toBe(0);
  });

  it('todos가 배열이 아니면 빈 목록과 droppedCount 0을 반환한다', () => {
    expect(getTodosForProject(undefined, 'p1')).toEqual({ todos: [], droppedCount: 0 });
    expect(getTodosForProject(null, 'p1')).toEqual({ todos: [], droppedCount: 0 });
  });

  it('일치하는 항목이 없으면 빈 목록을 반환한다', () => {
    const todos = [{ id: 't1', project_id: 'p2' }];
    expect(getTodosForProject(todos, 'p1').todos).toEqual([]);
  });

  it('배열 안의 null 원소는 무시한다', () => {
    const todos = [null, { id: 't1', project_id: 'p1' }];
    expect(getTodosForProject(todos, 'p1').todos.map((t) => t.id)).toEqual(['t1']);
  });

  it('projectId가 undefined면 project_id가 undefined인 할일만 매칭된다(전부 매칭되지 않음)', () => {
    const todos = [{ id: 't1', project_id: 'p1' }, { id: 't2', project_id: null }];
    expect(getTodosForProject(todos, undefined).todos).toEqual([]);
  });
});
