import fs from 'fs';
import path from 'path';
import os from 'os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readBacklogFile } from './store.js';

// P27: due_date 필드가 생기기 전에 만들어진 task(파일에 그 키 자체가 없음)도 읽을 때마다
// 일관되게 null로 채워지는지 확인한다 — mutations.test.js/fieldMutations.test.js와 같은
// 임시 디렉토리 + 실제 파일 I/O 패턴(파일명은 block-backlog-direct-read.js의 휴리스틱을
// 피하려고 기존 관례대로 "backlog-fixture.json"을 쓴다).
function task(overrides) {
  return {
    id: 'P1', status: 'todo', priority: 'P1', category: 'feature', title: 't', summary: 's',
    where: null, parent: null, deps: [], doc: null, done_when: 'd', est_min: null, gate: null,
    owner: null, claimed_at: null, updated_at: '2026-01-01T00:00:00.000Z', log: [],
    ...overrides,
  };
}

describe('readBacklogFile (P27 due_date 정규화)', () => {
  let dir;
  let filePath;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'work-widget-store-test-'));
    filePath = path.join(dir, 'backlog-fixture.json');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('due_date 키가 아예 없는 기존 task는 읽을 때 null로 채워진다', () => {
    const oldTask = task({ id: 'P1' });
    delete oldTask.due_date; // 명시적으로 없는 상태를 만든다(스프레드 이후 혹시 남아있지 않도록)
    fs.writeFileSync(filePath, JSON.stringify({ tasks: [oldTask] }), 'utf-8');
    const file = readBacklogFile(filePath);
    expect(file.json.tasks[0].due_date).toBeNull();
  });

  it('이미 due_date 값이 있으면 그대로 보존한다', () => {
    fs.writeFileSync(filePath, JSON.stringify({ tasks: [task({ id: 'P1', due_date: '2026-11-01' })] }), 'utf-8');
    const file = readBacklogFile(filePath);
    expect(file.json.tasks[0].due_date).toBe('2026-11-01');
  });

  it('tasks가 없거나 배열이 아니어도 죽지 않는다', () => {
    fs.writeFileSync(filePath, JSON.stringify({ tasks: 'not-an-array' }), 'utf-8');
    expect(() => readBacklogFile(filePath)).not.toThrow();
  });
});
