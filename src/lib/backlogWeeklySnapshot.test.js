import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveWeeklySnapshot, diffWeeklyChanges, countTasksByStatus } from './backlogWeeklySnapshot.js';

function task(overrides = {}) {
  return { id: 't1', title: 'A', status: 'todo', owner: null, ...overrides };
}

describe('resolveWeeklySnapshot', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('기준선이 없으면 지금 상태를 이번 주 기준선으로 새로 만든다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 16)); // 2026-09-16 수요일 -> 이번 주 일요일 09-13
    const tasks = [task()];
    expect(resolveWeeklySnapshot(null, tasks)).toEqual({ weekStart: '2026-09-13', tasks });
  });

  it('기준선이 이번 주 것이면 참조를 그대로 돌려준다(불필요한 재저장 방지)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 16));
    const snapshot = { weekStart: '2026-09-13', tasks: [task()] };
    expect(resolveWeeklySnapshot(snapshot, [task({ status: 'done' })])).toBe(snapshot);
  });

  it('기준선이 지난 주 것이면 지금 상태로 새 기준선을 만든다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 16)); // 이번 주 일요일 09-13
    const oldSnapshot = { weekStart: '2026-09-06', tasks: [task({ status: 'done' })] };
    const currentTasks = [task({ status: 'todo' })];
    expect(resolveWeeklySnapshot(oldSnapshot, currentTasks)).toEqual({ weekStart: '2026-09-13', tasks: currentTasks });
  });

  // P18(주 시작 요일 월→일 전환) 호환: 전환 이전에 저장된 기준선은 weekStart가 "그 주의
  // 월요일"이다 — 새 규칙(일요일)으로 갓 바뀐 첫 주에 그 값을 만나도 과거 task 스냅샷을
  // 버리지 않고 이어받되 표기만 고쳐 쓴다(critical-reviewer 지적, High).
  it('기준선의 weekStart가 이번 주 월요일(전환 이전 표기)이면 리셋하지 않고 이어받는다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 16)); // 이번 주 일요일 09-13, 월요일은 09-14
    const legacyMondaySnapshot = { weekStart: '2026-09-14', tasks: [task({ status: 'todo' })] };
    const currentTasks = [task({ status: 'done' })];
    expect(resolveWeeklySnapshot(legacyMondaySnapshot, currentTasks)).toEqual({
      weekStart: '2026-09-13',
      tasks: legacyMondaySnapshot.tasks,
    });
  });
});

describe('diffWeeklyChanges', () => {
  it('기준선에 없던 id는 added로 분류한다', () => {
    const snapshot = { weekStart: '2026-09-14', tasks: [] };
    const current = [task({ id: 't1' })];
    expect(diffWeeklyChanges(snapshot, current)).toEqual({ added: current, removed: [], statusChanged: [] });
  });

  it('같은 id인데 status가 다르면 statusChanged로 분류하고 previousStatus를 붙인다', () => {
    const snapshot = { weekStart: '2026-09-14', tasks: [task({ id: 't1', status: 'todo' })] };
    const current = [task({ id: 't1', status: 'done' })];
    const result = diffWeeklyChanges(snapshot, current);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.statusChanged).toEqual([{ ...current[0], previousStatus: 'todo' }]);
  });

  it('기준선에는 있었는데 지금 없는 id는 removed로 분류한다', () => {
    const removedTask = task({ id: 't1' });
    const snapshot = { weekStart: '2026-09-14', tasks: [removedTask] };
    expect(diffWeeklyChanges(snapshot, [])).toEqual({ added: [], removed: [removedTask], statusChanged: [] });
  });

  it('status가 같으면 변화 없음으로 취급한다(세 목록 모두 빈 배열)', () => {
    const snapshot = { weekStart: '2026-09-14', tasks: [task({ id: 't1', status: 'todo' })] };
    const current = [task({ id: 't1', status: 'todo' })];
    expect(diffWeeklyChanges(snapshot, current)).toEqual({ added: [], removed: [], statusChanged: [] });
  });

  it('기준선이 null이어도(첫 확인 직후 등) 안전하게 동작한다', () => {
    expect(diffWeeklyChanges(null, [task()])).toEqual({ added: [task()], removed: [], statusChanged: [] });
  });
});

describe('countTasksByStatus', () => {
  it('상태별 개수를 등장 순서대로 돌려준다', () => {
    const tasks = [
      task({ id: 't1', status: 'todo' }),
      task({ id: 't2', status: 'done' }),
      task({ id: 't3', status: 'todo' }),
    ];
    expect(countTasksByStatus(tasks)).toEqual([
      { status: 'todo', count: 2 },
      { status: 'done', count: 1 },
    ]);
  });

  it('빈 목록이면 빈 배열을 돌려준다', () => {
    expect(countTasksByStatus([])).toEqual([]);
  });
});
