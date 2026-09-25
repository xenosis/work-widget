import fs from 'fs';
import path from 'path';
import os from 'os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { pruneOldBackups, todayDateStamp, normalizeData } from './dataStore.js';

// P7.3 critical-reviewer 지적: 백업 정리(pruneOldBackups)는 dir을 인자로 받는 순수 fs 로직이라
// Electron 런타임 없이도 검증 가능하다 — getBackupDir/backupIfNeeded처럼 app.getPath에 의존하는
// 함수는 여기서 테스트하지 않는다(vite.config.js 주석 참고).

describe('todayDateStamp', () => {
  it('YYYY-MM-DD 형식을 돌려준다', () => {
    expect(todayDateStamp()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('pruneOldBackups', () => {
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'work-widget-backup-test-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function touch(name) {
    fs.writeFileSync(path.join(dir, name), '{}');
  }

  it('개수가 보관 기준 이하면 아무것도 지우지 않는다', () => {
    ['data-2026-09-01.json', 'data-2026-09-02.json'].forEach(touch);
    pruneOldBackups(dir, 'data-2026-09-02.json', 7);
    expect(fs.readdirSync(dir).sort()).toEqual(['data-2026-09-01.json', 'data-2026-09-02.json']);
  });

  it('보관 기준을 넘으면 오래된 것부터 지운다', () => {
    for (let d = 1; d <= 9; d += 1) touch(`data-2026-09-${String(d).padStart(2, '0')}.json`);
    pruneOldBackups(dir, 'data-2026-09-09.json', 7);
    const remaining = fs.readdirSync(dir).sort();
    expect(remaining).toHaveLength(7);
    expect(remaining).toEqual([
      'data-2026-09-03.json',
      'data-2026-09-04.json',
      'data-2026-09-05.json',
      'data-2026-09-06.json',
      'data-2026-09-07.json',
      'data-2026-09-08.json',
      'data-2026-09-09.json',
    ]);
  });

  it('형식이 다른 파일(사람이 만든 것 등)은 건드리지 않는다', () => {
    for (let d = 1; d <= 9; d += 1) touch(`data-2026-09-${String(d).padStart(2, '0')}.json`);
    touch('backup.json');
    touch('data-corrupted.json');
    pruneOldBackups(dir, 'data-2026-09-09.json', 7);
    const remaining = fs.readdirSync(dir);
    expect(remaining).toContain('backup.json');
    expect(remaining).toContain('data-corrupted.json');
  });

  it('미래 날짜 파일이 섞여 있어도 방금 만든(protectedName) 백업은 삭제되지 않는다', () => {
    // 시계 오류 등으로 미래 날짜 파일이 여럿 있으면 문자열 정렬상 그게 항상 "최신"이 되어
    // 방금 만든 오늘자 백업이 개수 밀림으로 삭제될 수 있었다(critical-reviewer 지적) — protectedName은
    // 삭제 후보에서 항상 제외되어야 한다.
    for (let d = 1; d <= 7; d += 1) touch(`data-2099-01-${String(d).padStart(2, '0')}.json`);
    touch('data-2026-09-24.json'); // 오늘 막 만든 백업
    pruneOldBackups(dir, 'data-2026-09-24.json', 7);
    expect(fs.existsSync(path.join(dir, 'data-2026-09-24.json'))).toBe(true);
  });
});

// P6.4: 구버전 레코드에 B3 신규 필드가 없어도(undefined) 기본값이 채워지는지 확인한다.
describe('normalizeData', () => {
  it('todo에 tags/priority/completed_at 등이 없으면 기본값을 채운다', () => {
    const result = normalizeData({ todos: [{ id: 't1', project_id: 'p1', title: '옛날 할일' }] });
    expect(result.todos[0]).toMatchObject({
      id: 't1',
      title: '옛날 할일',
      completed: false,
      completed_at: null,
      due_date: null,
      priority: null,
      tags: [],
    });
  });

  it('memo에 content가 없으면 빈 문자열로 채운다', () => {
    const result = normalizeData({ memos: [{ id: 'm1', title: '옛날 메모' }] });
    expect(result.memos[0].content).toBe('');
  });

  it('schedule에 is_recurring/recurrence_days가 없으면 기본값을 채운다', () => {
    const result = normalizeData({ schedules: [{ id: 's1', title: '옛날 일정', date: '2026-01-01' }] });
    expect(result.schedules[0]).toMatchObject({ is_recurring: false, recurrence_days: null });
  });

  it('project에 status/description이 없으면 기본값을 채운다', () => {
    const result = normalizeData({ projects: [{ id: 'p1', name: '옛날 프로젝트' }] });
    expect(result.projects[0]).toMatchObject({ status: '진행중', description: null, due_date: null });
  });

  it('이미 값이 있는 필드는 덮어쓰지 않는다(누락된 것만 채움)', () => {
    const result = normalizeData({ todos: [{ id: 't1', title: '할일', completed: true, tags: ['급함'] }] });
    expect(result.todos[0].completed).toBe(true);
    expect(result.todos[0].tags).toEqual(['급함']);
  });

  // critical-reviewer 지적: "덮어쓰지 않는다" 테스트가 truthy 값만 확인해서, undefined 비교를
  // ||나 ??=로 잘못 바꿔도 안 걸렸다 — null과 falsy-but-defined 값(false/''/[]) 보존을
  // 명시적으로 고정한다.
  it('null이나 falsy-but-defined 값(false/빈 문자열/빈 배열)은 undefined가 아니므로 그대로 둔다', () => {
    const result = normalizeData({
      todos: [{ id: 't1', title: '', completed: false, tags: [], priority: null, due_date: null }],
    });
    expect(result.todos[0]).toMatchObject({
      title: '',
      completed: false,
      tags: [],
      priority: null,
      due_date: null,
    });
  });

  it('기본값으로 채운 tags 배열은 레코드마다 독립된 인스턴스다(참조 공유 없음)', () => {
    const result = normalizeData({
      todos: [
        { id: 't1', title: 'A' },
        { id: 't2', title: 'B' },
      ],
    });
    expect(result.todos[0].tags).not.toBe(result.todos[1].tags);
    result.todos[0].tags.push('오염');
    expect(result.todos[1].tags).toEqual([]);
  });

  it('스키마 밖 필드(예: 향후 버전 필드)는 그대로 보존한다', () => {
    const result = normalizeData({ todos: [{ id: 't1', title: 'A', future_field: 'x' }] });
    expect(result.todos[0].future_field).toBe('x');
  });
});
