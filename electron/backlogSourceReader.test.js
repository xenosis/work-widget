import fs from 'fs';
import path from 'path';
import os from 'os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseBacklogSourceTasks, readBacklogSourceFile, MAX_FILE_SIZE_BYTES } from './backlogSourceReader.js';

describe('parseBacklogSourceTasks', () => {
  it('최상위가 배열이면 그대로 task 목록으로 본다', () => {
    const json = JSON.stringify([{ id: 't1', title: '할일', status: 'todo' }]);
    expect(parseBacklogSourceTasks(json)).toEqual({
      tasks: [{ id: 't1', title: '할일', status: 'todo', owner: null, due_date: null }],
      recognized: true,
      skippedCount: 0,
    });
  });

  it('tasks/items/backlog 키 배열도 인식한다', () => {
    for (const key of ['tasks', 'items', 'backlog']) {
      const json = JSON.stringify({ [key]: [{ id: 't1', title: 'A', status: 'done' }] });
      const result = parseBacklogSourceTasks(json);
      expect(result.recognized).toBe(true);
      expect(result.tasks[0]).toMatchObject({ id: 't1' });
    }
  });

  it('인식 가능한 배열이 없으면 recognized:false, 빈 목록(오류 아님)을 돌려준다', () => {
    expect(parseBacklogSourceTasks(JSON.stringify({ foo: 'bar' }))).toEqual({
      tasks: [],
      recognized: false,
      skippedCount: 0,
    });
  });

  it('id가 없거나 문자열이 아닌 항목은 걸러내고 skippedCount에 반영한다', () => {
    const json = JSON.stringify([{ title: 'id 없음' }, { id: 42, title: '숫자 id' }, { id: 't1', title: '정상' }]);
    const result = parseBacklogSourceTasks(json);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].id).toBe('t1');
    expect(result.skippedCount).toBe(2);
  });

  it('title/status가 없거나 빈 문자열이면 자리표시자로 채운다', () => {
    const json = JSON.stringify([{ id: 't1' }, { id: 't2', title: '', status: '  ' }]);
    const result = parseBacklogSourceTasks(json);
    expect(result.tasks[0]).toMatchObject({ title: '(제목 없음)', status: '(상태 없음)' });
    expect(result.tasks[1]).toMatchObject({ title: '(제목 없음)', status: '(상태 없음)' });
  });

  it('owner가 문자열이면 그대로, 없으면 null이다', () => {
    const json = JSON.stringify([{ id: 't1', owner: '홍길동' }, { id: 't2' }]);
    const result = parseBacklogSourceTasks(json).tasks;
    expect(result[0].owner).toBe('홍길동');
    expect(result[1].owner).toBeNull();
  });

  it('배열 안 null/객체 아닌 항목은 안전하게 건너뛴다', () => {
    const json = JSON.stringify([null, 'string', 42, { id: 't1' }]);
    const result = parseBacklogSourceTasks(json);
    expect(result.tasks).toHaveLength(1);
    expect(result.skippedCount).toBe(3);
  });

  it('유효하지 않은 JSON이면 그대로 예외를 던진다(호출부가 소스별로 잡아 처리)', () => {
    expect(() => parseBacklogSourceTasks('{ 이건 JSON이 아님')).toThrow();
  });

  it('UTF-8 BOM이 앞에 붙어 있어도 정상 파싱한다', () => {
    const json = '﻿' + JSON.stringify([{ id: 't1', title: 'BOM 테스트' }]);
    const result = parseBacklogSourceTasks(json);
    expect(result.tasks[0]).toMatchObject({ id: 't1', title: 'BOM 테스트' });
  });

  // P28: due_date(P27에서 backlog CLI 스키마에 추가됨)도 있으면 함께 읽는다 — 다른 필드와
  // 같은 관대한 파싱(없거나 이상해도 에러 없이 null).
  describe('due_date(P28)', () => {
    it('올바른 YYYY-MM-DD 문자열은 그대로 읽는다', () => {
      const json = JSON.stringify([{ id: 't1', due_date: '2026-10-05' }]);
      expect(parseBacklogSourceTasks(json).tasks[0].due_date).toBe('2026-10-05');
    });

    it('없으면 null이다', () => {
      const json = JSON.stringify([{ id: 't1' }]);
      expect(parseBacklogSourceTasks(json).tasks[0].due_date).toBeNull();
    });

    it('형식이 잘못되거나 존재하지 않는 날짜면 오류 없이 null로 무시한다', () => {
      const json = JSON.stringify([
        { id: 't1', due_date: '2026/10/05' },
        { id: 't2', due_date: '2026-13-01' },
        { id: 't3', due_date: 20261005 },
      ]);
      const tasks = parseBacklogSourceTasks(json).tasks;
      expect(tasks.every((t) => t.due_date === null)).toBe(true);
    });
  });
});

describe('readBacklogSourceFile', () => {
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'backlog-source-test-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('경로가 문자열이 아니거나 비어있으면 오류를 돌려준다', async () => {
    expect(await readBacklogSourceFile(null)).toMatchObject({ ok: false });
    expect(await readBacklogSourceFile('')).toMatchObject({ ok: false });
  });

  it('파일이 존재하지 않으면 오류를 돌려준다', async () => {
    const result = await readBacklogSourceFile(path.join(dir, 'does-not-exist.json'));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/찾을 수 없습니다/);
  });

  it('경로가 디렉터리면 오류를 돌려준다', async () => {
    const result = await readBacklogSourceFile(dir);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/폴더가 선택/);
  });

  it('JSON 파싱에 실패하면 그 소스만 오류로 표시한다(예외를 던지지 않음)', async () => {
    const filePath = path.join(dir, 'broken.json');
    fs.writeFileSync(filePath, '{ 이건 JSON이 아님');
    const result = await readBacklogSourceFile(filePath);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/읽지 못했습니다/);
  });

  it('정상 JSON 파일은 tasks/recognized/skippedCount를 돌려준다', async () => {
    const filePath = path.join(dir, 'good.json');
    fs.writeFileSync(filePath, JSON.stringify({ tasks: [{ id: 't1', title: 'A', status: 'todo' }] }));
    const result = await readBacklogSourceFile(filePath);
    expect(result).toMatchObject({ ok: true, recognized: true, skippedCount: 0 });
    expect(result.tasks).toHaveLength(1);
  });

  it('파일 크기가 상한을 넘으면 읽지 않고 오류를 돌려준다', async () => {
    const filePath = path.join(dir, 'huge.json');
    fs.writeFileSync(filePath, Buffer.alloc(MAX_FILE_SIZE_BYTES + 1, ' '));
    const result = await readBacklogSourceFile(filePath);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/너무 큽니다/);
  });
});
