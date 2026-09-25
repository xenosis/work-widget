import { describe, it, expect } from 'vitest';
import { createTodo } from './todoFactory.js';

describe('createTodo', () => {
  it('B3.2 스키마 10개 필드를 전부 채운다', () => {
    const todo = createTodo('p1', '새 할일', '2026-09-17T00:00:00.000Z');
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
});
