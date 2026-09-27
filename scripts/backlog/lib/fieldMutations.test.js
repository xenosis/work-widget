import fs from 'fs';
import path from 'path';
import os from 'os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setField } from './fieldMutations.js';

// BacklogError는 여기서 import하지 않는다 — 이 테스트 파일(ESM)이 './schema.js'를 import하는
// 경로와 fieldMutations.js(CJS)가 require('./schema')로 얻는 경로가 vitest의 CJS/ESM interop
// 상 서로 다른 모듈 인스턴스가 될 수 있어(실제로 겪음) instanceof 비교가 거짓으로 실패한다.
// 대신 모든 실패 케이스에서 공통인 .code 문자열 속성으로 "BacklogError답게 실패했는지" 확인한다.
function expectBacklogError(fn) {
  expect(fn).toThrow();
  try {
    fn();
    throw new Error('예상과 달리 예외가 발생하지 않았습니다.');
  } catch (err) {
    expect(typeof err.code).toBe('string');
    return err;
  }
}

// P11 critical-reviewer 지적: setField는 loadMutateValidateSave(실제 파일 I/O)를 거치므로
// dataStore.test.js/windowState.test.js와 같은 임시 디렉토리 패턴으로 실제 파일에 대해
// 검증한다 — 리뷰에서 지적된 boolean 플래그 강제 변환, est_min NaN 무시, --note 누락,
// parent 자기순환/자기참조, deps 중복 등을 CLI 수동 테스트가 아니라 회귀 테스트로 고정한다.

function task(overrides) {
  return {
    id: 'P1', status: 'todo', priority: 'P1', category: 'feature', title: 't', summary: 's',
    where: null, parent: null, deps: [], doc: null, done_when: 'd', est_min: null, gate: null,
    owner: null, claimed_at: null, updated_at: '2026-01-01T00:00:00.000Z', log: [],
    ...overrides,
  };
}

describe('setField', () => {
  let dir;
  let filePath;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'work-widget-setfield-test-'));
    filePath = path.join(dir, 'backlog-fixture.json');
    const json = {
      enums: {
        status: ['todo', 'in_progress', 'in_review', 'needs_info', 'blocked', 'done', 'cancelled'],
        priority: ['P0', 'P1', 'P2', 'P3'],
        category: ['feature', 'infra', 'bug'],
      },
      tasks: [
        task({ id: 'P1' }),
        task({ id: 'P1.1', parent: 'P1' }),
        task({ id: 'P2' }),
      ],
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

  it('summary를 고치고 log에 field_edit(before/after)를 남긴다', () => {
    setField(filePath, undefined, 'P1', { summary: '새 요약' }, { note: '수정 근거', owner: 'tester' });
    const updated = readTask('P1');
    expect(updated.summary).toBe('새 요약');
    const last = updated.log[updated.log.length - 1];
    expect(last.note).toBe('수정 근거');
    expect(last.owner).toBe('tester');
    expect(last.status).toBe('todo'); // 상태는 안 바뀜
    expect(last.field_edit).toEqual({ before: { summary: 's' }, after: { summary: '새 요약' } });
  });

  it('--note 없이는 거부한다', () => {
    expectBacklogError(() => setField(filePath, undefined, 'P1', { summary: 'x' }, {}));
  });

  it('--note만 넘겨 boolean true가 되면 거부한다', () => {
    expectBacklogError(() => setField(filePath, undefined, 'P1', { summary: 'x' }, { note: true }));
  });

  it('허용되지 않은 필드(status)는 거부한다', () => {
    expectBacklogError(() => setField(filePath, undefined, 'P1', { status: 'done' }, { note: 'n' }));
  });

  it('값 없이 --field만 넘겨 boolean true가 되면 거부한다(where/gate 등)', () => {
    expectBacklogError(() => setField(filePath, undefined, 'P1', { where: true }, { note: 'n' }));
    expectBacklogError(() => setField(filePath, undefined, 'P1', { gate: true }, { note: 'n' }));
    expectBacklogError(() => setField(filePath, undefined, 'P1', { title: true }, { note: 'n' }));
  });

  it('title/summary/done_when을 빈 문자열로 바꾸는 것은 거부한다', () => {
    expectBacklogError(() => setField(filePath, undefined, 'P1', { title: '  ' }, { note: 'n' }));
  });

  it('est_min에 숫자가 아닌 값을 주면 거부한다(예전엔 NaN->null로 조용히 저장됐음)', () => {
    expectBacklogError(() => setField(filePath, undefined, 'P1', { est_min: 'abc' }, { note: 'n' }));
  });

  it('est_min에 음수를 주면 거부한다', () => {
    expectBacklogError(() => setField(filePath, undefined, 'P1', { est_min: '-5' }, { note: 'n' }));
  });

  it('est_min을 빈 문자열로 주면 null로 비운다', () => {
    setField(filePath, undefined, 'P2', { est_min: '30' }, { note: 'n1' });
    setField(filePath, undefined, 'P2', { est_min: '' }, { note: 'n2' });
    expect(readTask('P2').est_min).toBeNull();
  });

  it('where/doc/gate/parent는 빈 문자열이나 "null" 문자열로 비울 수 있다', () => {
    setField(filePath, undefined, 'P2', { where: 'src/foo.js' }, { note: 'n' });
    setField(filePath, undefined, 'P2', { where: 'null' }, { note: 'n2' });
    expect(readTask('P2').where).toBeNull();
  });

  it('deps 중복은 제거되어 저장된다', () => {
    setField(filePath, undefined, 'P2', { deps: 'P1,P1,P1.1' }, { note: 'n' });
    expect(readTask('P2').deps).toEqual(['P1', 'P1.1']);
  });

  it('존재하지 않는 deps id는 거부한다', () => {
    expectBacklogError(() => setField(filePath, undefined, 'P2', { deps: 'P9' }, { note: 'n' }));
  });

  it('자기 자신을 deps로 넣는 것은 거부한다', () => {
    expectBacklogError(() => setField(filePath, undefined, 'P2', { deps: 'P2' }, { note: 'n' }));
  });

  it('parent를 자기 자신으로 바꾸는 것은 거부한다', () => {
    expectBacklogError(() => setField(filePath, undefined, 'P2', { parent: 'P2' }, { note: 'n' }));
  });

  it('존재하지 않는 parent는 거부한다', () => {
    expectBacklogError(() => setField(filePath, undefined, 'P2', { parent: 'P9' }, { note: 'n' }));
  });

  it('parent 순환이 생기는 변경은 거부한다', () => {
    // P1.1의 parent를 P1.1 자신의 자손 쪽으로 돌리는 상황을 재현: 먼저 P2.parent=P1.1로 만든 뒤,
    // P1.1의 parent를 P2로 바꾸면 P1.1 -> P2 -> P1.1 순환이 생긴다.
    setField(filePath, undefined, 'P2', { parent: 'P1.1' }, { note: 'setup' });
    expectBacklogError(() => setField(filePath, undefined, 'P1.1', { parent: 'P2' }, { note: 'n' }));
  });

  it('parent를 바꾸면 새 부모의 형제 옆으로 배열 위치도 옮긴다', () => {
    setField(filePath, undefined, 'P2', { parent: 'P1' }, { note: 'n' });
    const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const ids = json.tasks.map((t) => t.id);
    // P1의 마지막 형제(P1.1) 바로 뒤로 P2가 와야 한다.
    expect(ids.indexOf('P2')).toBe(ids.indexOf('P1.1') + 1);
  });

  it('priority/category enum에 없는 값은 거부한다', () => {
    expectBacklogError(() => setField(filePath, undefined, 'P1', { priority: 'PX' }, { note: 'n' }));
    expectBacklogError(() => setField(filePath, undefined, 'P1', { category: 'nope' }, { note: 'n' }));
  });

  it('존재하지 않는 id는 NOT_FOUND로 거부한다', () => {
    expectBacklogError(() => setField(filePath, undefined, 'P404', { summary: 'x' }, { note: 'n' }));
  });

  // P27
  it('올바른 due_date로 고칠 수 있다', () => {
    setField(filePath, undefined, 'P1', { due_date: '2026-11-20' }, { note: 'n' });
    expect(readTask('P1').due_date).toBe('2026-11-20');
  });

  it('빈 문자열이나 "null"로 due_date를 비울 수 있다', () => {
    setField(filePath, undefined, 'P1', { due_date: '2026-11-20' }, { note: 'n' });
    setField(filePath, undefined, 'P1', { due_date: '' }, { note: '취소' });
    expect(readTask('P1').due_date).toBeNull();
  });

  it('형식이 잘못된 due_date는 거부한다', () => {
    expectBacklogError(() => setField(filePath, undefined, 'P1', { due_date: '2026/11/20' }, { note: 'n' }));
    expectBacklogError(() => setField(filePath, undefined, 'P1', { due_date: '2026-02-30' }, { note: 'n' }));
  });

  it('값 없이 --due_date만 넘겨 boolean true가 되면 거부한다', () => {
    expectBacklogError(() => setField(filePath, undefined, 'P1', { due_date: true }, { note: 'n' }));
  });
});
