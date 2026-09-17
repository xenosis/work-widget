import { describe, it, expect } from 'vitest';
import { deriveProjectStatus } from './projectStatus.js';

const mixed = [
  { project_id: 'p1', completed: true },
  { project_id: 'p1', completed: false },
  { project_id: 'p2', completed: true },
];

describe('deriveProjectStatus', () => {
  it('프로젝트별로 필터링한다 — p1은 일부 미완료라 진행중 유지', () => {
    expect(deriveProjectStatus('진행중', 'p1', mixed)).toBe('진행중');
  });

  it('프로젝트별로 필터링한다 — p2는 전부완료라 완료 전환', () => {
    expect(deriveProjectStatus('진행중', 'p2', mixed)).toBe('완료');
  });

  it('완료 상태에서 미완료가 생기면 진행중으로 복귀', () => {
    expect(deriveProjectStatus('완료', 'p1', mixed)).toBe('진행중');
  });

  it('전부완료가 계속되면 완료 유지', () => {
    expect(deriveProjectStatus('완료', 'p2', mixed)).toBe('완료');
  });

  it('보류는 전부완료여도 절대 안 바뀐다', () => {
    expect(deriveProjectStatus('보류', 'p2', mixed)).toBe('보류');
  });

  it('소속 todo가 0개면 전부완료로 보지 않는다(진행중 유지)', () => {
    expect(deriveProjectStatus('진행중', 'p3', mixed)).toBe('진행중');
  });

  it('소속 todo가 0개인데 완료 상태였다면 진행중으로 복귀', () => {
    expect(deriveProjectStatus('완료', 'p3', mixed)).toBe('진행중');
  });

  it('todos가 undefined여도 방어한다', () => {
    expect(deriveProjectStatus('완료', 'p1', undefined)).toBe('진행중');
  });

  it('completed가 boolean true가 아니면 미완료로 취급한다', () => {
    const todos = [
      { project_id: 'p9', completed: true },
      { project_id: 'p9', completed: 'true' },
    ];
    expect(deriveProjectStatus('진행중', 'p9', todos)).toBe('진행중');
  });

  it('enum 밖 status(오타)는 진행중으로 정규화한다', () => {
    expect(deriveProjectStatus('진행중임', 'p1', mixed)).toBe('진행중');
  });

  it('status가 null이어도 진행중으로 정규화한다', () => {
    expect(deriveProjectStatus(null, 'p3', mixed)).toBe('진행중');
  });
});
