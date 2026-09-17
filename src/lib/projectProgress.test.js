import { describe, it, expect } from 'vitest';
import { calculateProjectProgress } from './projectProgress.js';

describe('calculateProjectProgress', () => {
  it('2/3 완료면 67(반올림)', () => {
    const todos = [
      { project_id: 'p1', completed: true },
      { project_id: 'p1', completed: true },
      { project_id: 'p1', completed: false },
    ];
    expect(calculateProjectProgress('p1', todos)).toBe(67);
  });

  it('0/1 완료면 0', () => {
    expect(calculateProjectProgress('p1', [{ project_id: 'p1', completed: false }])).toBe(0);
  });

  it('2/2 완료면 100', () => {
    const todos = [
      { project_id: 'p1', completed: true },
      { project_id: 'p1', completed: true },
    ];
    expect(calculateProjectProgress('p1', todos)).toBe(100);
  });

  it('소속 todo가 없으면 0(아직 시작 전)', () => {
    const todos = [{ project_id: 'other', completed: true }];
    expect(calculateProjectProgress('p1', todos)).toBe(0);
  });

  it('빈 배열이면 0', () => {
    expect(calculateProjectProgress('p1', [])).toBe(0);
  });

  it('todos가 undefined면 0', () => {
    expect(calculateProjectProgress('p1', undefined)).toBe(0);
  });

  it('todos가 null이면 0', () => {
    expect(calculateProjectProgress('p1', null)).toBe(0);
  });

  it('반올림 .5 경계 — 1/8=12.5%는 Math.round 규칙대로 13', () => {
    const todos = [
      { project_id: 'p1', completed: true },
      ...Array.from({ length: 7 }, () => ({ project_id: 'p1', completed: false })),
    ];
    expect(calculateProjectProgress('p1', todos)).toBe(13);
  });

  it('completed가 boolean true가 아니면 미완료로 취급 + 배열 내 null 원소 방어(projectStatus와 동일 계약)', () => {
    const todos = [null, { project_id: 'p1', completed: true }, { project_id: 'p1', completed: 'true' }];
    expect(calculateProjectProgress('p1', todos)).toBe(50);
  });
});
