import { describe, it, expect } from 'vitest';
import { createTodo } from './todoFactory.js';

describe('createTodo', () => {
  it('B3.2 스키마 10개 필드를 전부 채운다', () => {
    const todo = createTodo('p1', '새 할일', null, '2026-09-17T00:00:00.000Z');
    expect(todo).toEqual({
      id: expect.any(String),
      project_id: 'p1',
      title: '새 할일',
      completed: false,
      completed_at: null,
      due_date: null,
      priority: null,
      tags: [],
      created_at: '2026-09-17T00:00:00.000Z',
      updated_at: '2026-09-17T00:00:00.000Z',
    });
  });

  it('id는 todo- 접두어를 가진 고유 문자열이다', () => {
    const a = createTodo('p1', '제목');
    const b = createTodo('p1', '제목');
    expect(a.id).toMatch(/^todo-/);
    expect(a.id).not.toBe(b.id);
  });

  it('now를 생략하면 현재 시각을 created_at/updated_at에 쓴다', () => {
    const before = Date.now();
    const todo = createTodo('p1', '제목');
    const after = Date.now();
    const createdAtMs = new Date(todo.created_at).getTime();
    expect(createdAtMs).toBeGreaterThanOrEqual(before);
    expect(createdAtMs).toBeLessThanOrEqual(after);
    expect(todo.created_at).toBe(todo.updated_at);
  });

  // P12.5: 추가 폼에서 마감일을 선택할 수 있게 되면서 dueDate가 now보다 앞자리 인자로 추가됨
  // (projectFactory.js의 createProject와 같은 패턴).
  it('dueDate를 넘기면 due_date에 그대로 저장된다', () => {
    const todo = createTodo('p1', '제목', '2026-10-01', '2026-09-17T00:00:00.000Z');
    expect(todo.due_date).toBe('2026-10-01');
  });

  it('dueDate를 생략하거나 null을 넘기면 due_date는 null이다', () => {
    expect(createTodo('p1', '제목').due_date).toBeNull();
    expect(createTodo('p1', '제목', null).due_date).toBeNull();
  });

  it('now를 생략하고 dueDate만 넘겨도 created_at은 호출 시점의 실제 ISO 문자열이다', () => {
    const before = Date.now();
    const todo = createTodo('p1', '제목', '2026-10-01');
    const after = Date.now();
    expect(todo.due_date).toBe('2026-10-01');
    const createdAtMs = new Date(todo.created_at).getTime();
    expect(createdAtMs).toBeGreaterThanOrEqual(before);
    expect(createdAtMs).toBeLessThanOrEqual(after);
  });
});
