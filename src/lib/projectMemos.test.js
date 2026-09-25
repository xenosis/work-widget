import { describe, it, expect } from 'vitest';
import { getMemosForProject } from './projectMemos.js';

describe('getMemosForProject', () => {
  it('project_id가 일치하는 메모만 반환한다', () => {
    const memos = [
      { id: 'm1', project_id: 'p1', updated_at: '2026-09-15T00:00:00.000Z' },
      { id: 'm2', project_id: 'p2', updated_at: '2026-09-15T00:00:00.000Z' },
      { id: 'm3', project_id: 'p1', updated_at: '2026-09-14T00:00:00.000Z' },
    ];
    expect(getMemosForProject(memos, 'p1').memos.map((m) => m.id)).toEqual(['m1', 'm3']);
  });

  it('id 없는 메모는 목록에서 제외하고 droppedCount에 반영한다', () => {
    const memos = [{ project_id: 'p1', title: 'id 없음' }, { id: 'm1', project_id: 'p1' }];
    const result = getMemosForProject(memos, 'p1');
    expect(result.memos.map((m) => m.id)).toEqual(['m1']);
    expect(result.droppedCount).toBe(1);
  });

  it('id가 문자열이 아니면(숫자 등) 제외한다', () => {
    const memos = [{ id: 123, project_id: 'p1' }, { id: 'm1', project_id: 'p1' }];
    expect(getMemosForProject(memos, 'p1').memos.map((m) => m.id)).toEqual(['m1']);
  });

  it('memos가 배열이 아니면 빈 목록과 droppedCount 0을 반환한다', () => {
    expect(getMemosForProject(undefined, 'p1')).toEqual({ memos: [], droppedCount: 0 });
    expect(getMemosForProject(null, 'p1')).toEqual({ memos: [], droppedCount: 0 });
  });

  it('일치하는 메모가 없으면 빈 목록을 반환한다', () => {
    expect(getMemosForProject([{ id: 'm1', project_id: 'p2' }], 'p1').memos).toEqual([]);
  });

  it('배열 안의 null 원소는 무시한다', () => {
    const memos = [null, { id: 'm1', project_id: 'p1' }];
    expect(getMemosForProject(memos, 'p1').memos.map((m) => m.id)).toEqual(['m1']);
  });

  it('projectId가 null이면(독립 메모 조회) project_id가 null인 메모만 매칭된다', () => {
    const memos = [
      { id: 'm1', project_id: null },
      { id: 'm2', project_id: 'p1' },
    ];
    expect(getMemosForProject(memos, null).memos.map((m) => m.id)).toEqual(['m1']);
  });

  it('updated_at 내림차순(최근 수정이 먼저)으로 정렬한다', () => {
    const memos = [
      { id: 'm1', project_id: 'p1', updated_at: '2026-09-10T00:00:00.000Z' },
      { id: 'm2', project_id: 'p1', updated_at: '2026-09-17T00:00:00.000Z' },
      { id: 'm3', project_id: 'p1', updated_at: '2026-09-14T00:00:00.000Z' },
    ];
    expect(getMemosForProject(memos, 'p1').memos.map((m) => m.id)).toEqual(['m2', 'm3', 'm1']);
  });
});
