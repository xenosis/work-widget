import { describe, it, expect } from 'vitest';
import { createProject } from './projectFactory.js';

describe('createProject', () => {
  it('B3.1 스키마 필드를 전부 채운다(진행률은 저장하지 않음 — 조회 시 계산)', () => {
    const project = createProject('새 프로젝트', '장기', null, '2026-09-17T00:00:00.000Z');
    expect(project).toEqual({
      id: expect.any(String),
      name: '새 프로젝트',
      type: '장기',
      status: '진행중',
      description: null,
      due_date: null,
      created_at: '2026-09-17T00:00:00.000Z',
      updated_at: '2026-09-17T00:00:00.000Z',
    });
  });

  // P12.4: 추가 폼에서 마감일을 선택할 수 있게 되면서 dueDate가 now보다 앞자리 인자로 추가됨.
  it('dueDate를 넘기면 due_date에 그대로 저장된다', () => {
    const project = createProject('새 프로젝트', '장기', '2026-10-01', '2026-09-17T00:00:00.000Z');
    expect(project.due_date).toBe('2026-10-01');
  });

  it('dueDate를 생략하면(2-인자 호출) due_date는 null이다(기존 호출부 하위호환)', () => {
    expect(createProject('새 프로젝트', '장기').due_date).toBeNull();
  });

  it('dueDate에 null을 명시적으로 넘겨도 due_date는 null이다(추가 폼에서 비운 채 제출하는 경로)', () => {
    expect(createProject('새 프로젝트', '장기', null).due_date).toBeNull();
  });

  // critical-reviewer 지적(P12.4 리뷰): now를 생략한 3-인자 호출(dueDate만 넘김)에서
  // created_at이 실제 현재 시각으로 채워지는지(옛 방식대로 3번째 자리에 now를 넘긴 것으로
  // 잘못 해석되지 않는지) 확인.
  it('now를 생략하고 dueDate만 넘기면 created_at은 호출 시점의 실제 ISO 문자열이다', () => {
    const before = Date.now();
    const project = createProject('새 프로젝트', '장기', '2026-10-01');
    const after = Date.now();
    expect(project.due_date).toBe('2026-10-01');
    const createdAtMs = new Date(project.created_at).getTime();
    expect(createdAtMs).toBeGreaterThanOrEqual(before);
    expect(createdAtMs).toBeLessThanOrEqual(after);
  });

  it('id는 project- 접두어를 가진 고유 문자열이다', () => {
    const a = createProject('a', '장기');
    const b = createProject('b', '장기');
    expect(a.id).toMatch(/^project-/);
    expect(a.id).not.toBe(b.id);
  });

  it('status는 항상 진행중으로 시작한다(완료/보류는 생성 시점에 선택할 수 없음)', () => {
    expect(createProject('a', '단기').status).toBe('진행중');
  });
});
