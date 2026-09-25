import { describe, it, expect } from 'vitest';
import { applyProjectUpdate, removeProjectCascade } from './projectMutations.js';

const NOW = '2026-09-18T00:00:00.000Z';

function project(overrides = {}) {
  return {
    id: 'project-1',
    name: '원래 이름',
    type: '장기',
    status: '진행중',
    description: null,
    due_date: null,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('applyProjectUpdate', () => {
  it('대상 프로젝트에 업데이트를 병합하고 updated_at을 갱신한다', () => {
    const projects = [project()];
    const next = applyProjectUpdate(projects, 'project-1', { name: '새 이름', status: '진행중' }, [], NOW);
    expect(next[0]).toMatchObject({ id: 'project-1', name: '새 이름', updated_at: NOW });
  });

  it('대상이 아닌 레코드는 그대로 둔다', () => {
    const other = project({ id: 'project-2', name: '다른 프로젝트' });
    const projects = [project(), other];
    const next = applyProjectUpdate(projects, 'project-1', { name: 'x', status: '진행중' }, [], NOW);
    expect(next[1]).toBe(other);
  });

  it('B4.3: 할일이 전부 완료가 아닌데 수동으로 완료를 고르면 진행중으로 되돌린다', () => {
    const projects = [project()];
    const todos = [{ project_id: 'project-1', completed: false }];
    const next = applyProjectUpdate(projects, 'project-1', { name: '원래 이름', status: '완료' }, todos, NOW);
    expect(next[0].status).toBe('진행중');
  });

  it('B4.3: 할일이 전부 완료면 완료로 저장된다', () => {
    const projects = [project()];
    const todos = [{ project_id: 'project-1', completed: true }];
    const next = applyProjectUpdate(projects, 'project-1', { name: '원래 이름', status: '진행중' }, todos, NOW);
    expect(next[0].status).toBe('완료');
  });

  it('B4.3: 보류는 자동 전환 대상이 아니라 그대로 저장된다', () => {
    const projects = [project()];
    const todos = [{ project_id: 'project-1', completed: false }];
    const next = applyProjectUpdate(projects, 'project-1', { name: '원래 이름', status: '보류' }, todos, NOW);
    expect(next[0].status).toBe('보류');
  });

  it('없는 id를 넘기면 배열을 그대로 반환한다', () => {
    const projects = [project()];
    const next = applyProjectUpdate(projects, 'project-none', { name: 'x', status: '진행중' }, [], NOW);
    expect(next).toEqual(projects);
  });

  it('배열 안 null 원소는 안전하게 건너뛴다', () => {
    const projects = [null, project()];
    const next = applyProjectUpdate(projects, 'project-1', { name: 'y', status: '진행중' }, [], NOW);
    expect(next[0]).toBeNull();
    expect(next[1].name).toBe('y');
  });
});

describe('removeProjectCascade', () => {
  it('대상 프로젝트와 소속 todo/memo를 함께 제거한다', () => {
    const projects = [project(), project({ id: 'project-2' })];
    const todos = [
      { id: 't1', project_id: 'project-1' },
      { id: 't2', project_id: 'project-2' },
    ];
    const memos = [
      { id: 'm1', project_id: 'project-1' },
      { id: 'm2', project_id: 'project-2' },
    ];
    const next = removeProjectCascade(projects, todos, memos, 'project-1');
    expect(next.projects).toHaveLength(1);
    expect(next.projects[0].id).toBe('project-2');
    expect(next.todos).toEqual([{ id: 't2', project_id: 'project-2' }]);
    expect(next.memos).toEqual([{ id: 'm2', project_id: 'project-2' }]);
  });

  it('배열 안 null 원소나 project_id 없는 원소가 있어도 죽지 않는다', () => {
    const projects = [null, project()];
    const todos = [null, { id: 't1' }];
    const memos = [null, { id: 'm1' }];
    const next = removeProjectCascade(projects, todos, memos, 'project-none');
    expect(next.projects).toEqual([null, project()]);
    expect(next.todos).toEqual([null, { id: 't1' }]);
    expect(next.memos).toEqual([null, { id: 'm1' }]);
  });

  it('id 없는 손상 레코드도 project_id만 맞으면 함께 지운다(화면 미리보기에는 안 보여도 실제로는 삭제 대상)', () => {
    const projects = [project()];
    const todos = [{ project_id: 'project-1' }, { id: 't1', project_id: 'project-2' }];
    const memos = [{ project_id: 'project-1' }];
    const next = removeProjectCascade(projects, todos, memos, 'project-1');
    expect(next.todos).toEqual([{ id: 't1', project_id: 'project-2' }]);
    expect(next.memos).toEqual([]);
  });
});
