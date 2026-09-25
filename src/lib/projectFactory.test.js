import { describe, it, expect } from 'vitest';
import { createProject } from './projectFactory.js';

describe('createProject', () => {
  it('B3.1 스키마 필드를 전부 채운다(진행률은 저장하지 않음 — 조회 시 계산)', () => {
    const project = createProject('새 프로젝트', '장기', '2026-09-17T00:00:00.000Z');
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
