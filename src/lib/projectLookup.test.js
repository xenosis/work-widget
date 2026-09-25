import { describe, it, expect } from 'vitest';
import { getProjectName, getUsableProjects, isOrphanProjectRef } from './projectLookup.js';

describe('getProjectName', () => {
  const projects = [
    { id: 'p1', name: '웹사이트 리뉴얼' },
    { id: 'p2', name: '월간 정산' },
  ];

  it('project_id가 일치하면 이름을 반환한다', () => {
    expect(getProjectName(projects, 'p1')).toBe('웹사이트 리뉴얼');
  });

  it('project_id가 없으면(null/undefined) null을 반환한다', () => {
    expect(getProjectName(projects, null)).toBeNull();
    expect(getProjectName(projects, undefined)).toBeNull();
  });

  it('가리키는 프로젝트가 없으면(삭제 등) null을 반환한다', () => {
    expect(getProjectName(projects, 'p-없음')).toBeNull();
  });

  it('projects가 배열이 아니면 null을 반환한다', () => {
    expect(getProjectName(undefined, 'p1')).toBeNull();
    expect(getProjectName(null, 'p1')).toBeNull();
  });

  it('일치하는 프로젝트에 name이 없으면(문자열이 아니면) null을 반환한다', () => {
    expect(getProjectName([{ id: 'p1' }], 'p1')).toBeNull();
  });
});

describe('getUsableProjects', () => {
  it('id가 없거나 문자열이 아닌 레코드, null 원소를 걸러낸다', () => {
    const projects = [
      { id: 'p1', name: 'A' },
      { id: 123, name: 'B(id가 숫자)' },
      { name: 'C(id 없음)' },
      null,
      { id: 'p2', name: 'D' },
    ];
    expect(getUsableProjects(projects).map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('id가 빈 문자열이면 걸러낸다(select의 "선택 안 함" value=""와 충돌 방지)', () => {
    const projects = [{ id: '', name: '빈id' }, { id: 'p1', name: 'A' }];
    expect(getUsableProjects(projects).map((p) => p.id)).toEqual(['p1']);
  });

  it('name이 없거나 빈 문자열이면 걸러낸다(빈 라벨 옵션 방지)', () => {
    const projects = [{ id: 'p1' }, { id: 'p2', name: '' }, { id: 'p3', name: '  ' }, { id: 'p4', name: 'D' }];
    expect(getUsableProjects(projects).map((p) => p.id)).toEqual(['p4']);
  });

  it('배열이 아니면 빈 배열을 반환한다', () => {
    expect(getUsableProjects(undefined)).toEqual([]);
    expect(getUsableProjects(null)).toEqual([]);
  });
});

describe('isOrphanProjectRef', () => {
  const projects = [{ id: 'p1', name: 'A' }];

  it('project_id가 없으면(null) 고아가 아니다', () => {
    expect(isOrphanProjectRef(projects, null)).toBe(false);
  });

  it('project_id가 usable 목록에 있으면 고아가 아니다', () => {
    expect(isOrphanProjectRef(projects, 'p1')).toBe(false);
  });

  it('project_id가 채워져 있지만 목록에 없으면 고아다', () => {
    expect(isOrphanProjectRef(projects, 'p-ghost')).toBe(true);
  });
});
