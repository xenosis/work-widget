import { describe, it, expect } from 'vitest';
import {
  getUsableBacklogSources,
  removeBacklogSource,
  deriveLabelFromPath,
  getSourceDisplayLabel,
} from './backlogSourceMutations.js';

function source(overrides = {}) {
  return {
    id: 'src-1',
    path: 'C:/교육/other-project/backlog.json',
    label: null,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('getUsableBacklogSources', () => {
  it('id/path 없는 레코드(수기 편집된 data.json 등)를 걸러낸다', () => {
    const next = getUsableBacklogSources([source(), { id: 'no-path' }, { path: 'x' }, null]);
    expect(next).toEqual([source()]);
  });
});

describe('removeBacklogSource', () => {
  it('대상 id를 제거한다', () => {
    const next = removeBacklogSource([source(), source({ id: 'src-2' })], 'src-1');
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe('src-2');
  });
});

describe('deriveLabelFromPath', () => {
  it('윈도우 경로에서 파일이 든 폴더 이름을 뽑는다', () => {
    expect(deriveLabelFromPath('C:\\Users\\Lenovo\\claudeProjects\\routine-planner\\backlog.json')).toBe(
      'routine-planner'
    );
  });

  it('POSIX 경로에서도 동일하게 동작한다', () => {
    expect(deriveLabelFromPath('/home/user/my-project/backlog.json')).toBe('my-project');
  });

  it('세그먼트가 파일명 하나뿐이면 그 파일명을 그대로 쓴다', () => {
    expect(deriveLabelFromPath('backlog.json')).toBe('backlog.json');
  });

  it('경로가 비어있거나 문자열이 아니면 알 수 없는 소스로 표시한다', () => {
    expect(deriveLabelFromPath('')).toBe('(알 수 없는 소스)');
    expect(deriveLabelFromPath(null)).toBe('(알 수 없는 소스)');
    expect(deriveLabelFromPath(undefined)).toBe('(알 수 없는 소스)');
  });
});

describe('getSourceDisplayLabel', () => {
  it('label이 있으면 그대로 쓴다', () => {
    expect(getSourceDisplayLabel(source({ label: '내 다른 프로젝트' }))).toBe('내 다른 프로젝트');
  });

  it('label이 없거나 빈 문자열이면 path에서 유도한다', () => {
    expect(getSourceDisplayLabel(source({ label: null }))).toBe('other-project');
    expect(getSourceDisplayLabel(source({ label: '  ' }))).toBe('other-project');
  });
});
