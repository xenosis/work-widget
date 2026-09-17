import { describe, it, expect } from 'vitest';
import { groupProjectsByType } from './projectGrouping.js';

describe('groupProjectsByType', () => {
  it('type이 장기/단기인 프로젝트를 각각의 그룹으로 나눈다', () => {
    const projects = [
      { id: 'p1', type: '장기' },
      { id: 'p2', type: '단기' },
    ];
    const { long, short, other } = groupProjectsByType(projects, []);
    expect(long.map((p) => p.id)).toEqual(['p1']);
    expect(short.map((p) => p.id)).toEqual(['p2']);
    expect(other).toEqual([]);
  });

  it('type이 장기/단기가 아니면 other로 분류하고 사라지지 않는다', () => {
    const projects = [
      { id: 'p1', type: '장기 ' }, // 트레일링 스페이스 오타
      { id: 'p2', type: null },
      { id: 'p3' }, // type 자체가 없음
    ];
    const { long, short, other } = groupProjectsByType(projects, []);
    expect(long).toEqual([]);
    expect(short).toEqual([]);
    expect(other.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
  });

  it('각 프로젝트에 progress를 계산해서 붙인다', () => {
    const projects = [{ id: 'p1', type: '장기' }];
    const todos = [
      { project_id: 'p1', completed: true },
      { project_id: 'p1', completed: false },
    ];
    const { long } = groupProjectsByType(projects, todos);
    expect(long[0].progress).toBe(50);
  });

  it('id가 없는 레코드는 제외한다', () => {
    const projects = [{ type: '장기' }, { id: 'p1', type: '장기' }];
    const { long } = groupProjectsByType(projects, []);
    expect(long.map((p) => p.id)).toEqual(['p1']);
  });

  it('projects가 배열이 아니어도 방어한다', () => {
    expect(groupProjectsByType(undefined, [])).toEqual({ long: [], short: [], other: [] });
  });
});
