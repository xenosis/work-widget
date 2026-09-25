import fs from 'fs';
import path from 'path';
import os from 'os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setStatus } from './mutations.js';

// P12.8 critical-reviewer 지적: setStatus가 done -> 다른 상태로 되돌릴 때 done_at을 안 지워서,
// done_at만 보는 도구/사람이 "완료됐다가 되돌아간" task를 여전히 완료로 오판할 수 있었다 —
// fieldMutations.test.js와 같은 임시 디렉토리 패턴으로 실제 파일 I/O를 거쳐 회귀 테스트로 고정한다.

function task(overrides) {
  return {
    id: 'P1', status: 'todo', priority: 'P1', category: 'feature', title: 't', summary: 's',
    where: null, parent: null, deps: [], doc: null, done_when: 'd', est_min: null, gate: null,
    owner: null, claimed_at: null, updated_at: '2026-01-01T00:00:00.000Z', log: [],
    ...overrides,
  };
}

describe('setStatus', () => {
  let dir;
  let filePath;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'work-widget-setstatus-test-'));
    filePath = path.join(dir, 'backlog-fixture.json');
    const json = {
      enums: {
        status: ['todo', 'in_progress', 'in_review', 'needs_info', 'blocked', 'done', 'cancelled'],
        priority: ['P0', 'P1', 'P2', 'P3'],
        category: ['feature', 'infra', 'bug'],
      },
      tasks: [task({ id: 'P1' })],
    };
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf-8');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function readTask(id) {
    const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return json.tasks.find((t) => t.id === id);
  }

  it('done으로 전이하면 done_at을 채운다', () => {
    setStatus(filePath, undefined, 'P1', 'done', { note: '완료 근거' });
    expect(readTask('P1').done_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('done에서 다른 상태로 되돌리면 done_at을 비운다', () => {
    setStatus(filePath, undefined, 'P1', 'done', { note: '완료 근거' });
    setStatus(filePath, undefined, 'P1', 'in_review', { note: '성급한 완료 처리 되돌림' });
    expect(readTask('P1').done_at).toBeNull();
  });

  it('done이 아닌 상태끼리 전이해도 done_at은 계속 비어 있다', () => {
    setStatus(filePath, undefined, 'P1', 'in_progress', { note: '착수' });
    expect(readTask('P1').done_at).toBeNull();
  });
});
