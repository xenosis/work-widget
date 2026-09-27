import { describe, it, expect } from 'vitest';
import {
  filterTasksWithDueDate,
  getBacklogDueItemsForDate,
  getScheduleCellSummary,
  getScheduleDotClassName,
} from './scheduleGrid.js';

// P28: 외부 backlog(.json) task의 due_date를 일정 탭 캘린더에 읽기 전용으로 얹기 위한 함수들.
// scheduleGrid.test.js가 이미 eslint max-lines(300)에 근접해(P23 당시 scheduleRangeGrouping.test.js
// 를 분리했던 것과 같은 이유) 여기로 분리한다.
describe('filterTasksWithDueDate', () => {
  it('due_date가 유효한 task만 남기고 sourceId/sourceLabel을 붙인다', () => {
    const tasks = [
      { id: 't1', title: 'A', status: 'todo', due_date: '2026-10-05' },
      { id: 't2', title: 'B', status: 'done', due_date: null },
      { id: 't3', title: 'C', status: 'todo' },
    ];
    const result = filterTasksWithDueDate(tasks, 'src1', '내 프로젝트');
    expect(result).toEqual([
      { id: 't1', title: 'A', status: 'todo', due_date: '2026-10-05', sourceId: 'src1', sourceLabel: '내 프로젝트' },
    ]);
  });

  it('빈 배열이면 빈 배열을 돌려준다', () => {
    expect(filterTasksWithDueDate([], 'src1', 'X')).toEqual([]);
  });

  // critical-reviewer 지적(Medium): electron 쪽(backlogSourceReader.test.js)은 형식이 이상한
  // due_date를 이미 커버하지만, 이 함수 자체도 독자적인 방어(DATE_STRING_RE)를 가지므로
  // 그 분기를 따로 고정해 둔다.
  it('형식이 잘못된 due_date는 오류 없이 걸러낸다', () => {
    const tasks = [
      { id: 't1', title: 'A', due_date: '2026-9-5' }, // 0 채움 없음
      { id: 't2', title: 'B', due_date: '' },
    ];
    expect(filterTasksWithDueDate(tasks, 'src1', 'X')).toEqual([]);
  });
});

describe('getBacklogDueItemsForDate', () => {
  it('해당 날짜의 항목만 걸러준다', () => {
    const items = [
      { id: 't1', due_date: '2026-10-05' },
      { id: 't2', due_date: '2026-10-06' },
    ];
    expect(getBacklogDueItemsForDate(items, '2026-10-05')).toEqual([{ id: 't1', due_date: '2026-10-05' }]);
  });
});

describe('getScheduleCellSummary(P28: backlogItems 통합)', () => {
  it('backlogItems를 안 넘기면(기존 호출부) 기존 동작 그대로다', () => {
    const schedules = [{ id: 's1', title: '회의', date: '2026-10-05', is_recurring: false, category_id: null }];
    const summary = getScheduleCellSummary(schedules, '2026-10-05', []);
    expect(summary.count).toBe(1);
    expect(summary.dots).toHaveLength(1);
  });

  it('그 날짜의 백로그 due_date 항목을 count/dots/titles에 합친다', () => {
    const backlogItems = [{ id: 'b1', title: 'P30 마감', status: 'todo', due_date: '2026-10-05', sourceLabel: 'X' }];
    const summary = getScheduleCellSummary([], '2026-10-05', [], 3, backlogItems);
    expect(summary.count).toBe(1);
    expect(summary.dots).toEqual([{ color: null, isRecurring: false, isBacklog: true }]);
    expect(summary.titles).toEqual(['[백로그] P30 마감']);
  });

  it('maxDots를 넘으면 백로그 항목도 overflowCount에 반영된다', () => {
    const backlogItems = [
      { id: 'b1', title: 'a', due_date: '2026-10-05' },
      { id: 'b2', title: 'b', due_date: '2026-10-05' },
    ];
    const schedules = [{ id: 's1', title: 'c', date: '2026-10-05', is_recurring: false, category_id: null }];
    const summary = getScheduleCellSummary(schedules, '2026-10-05', [], 1, backlogItems);
    expect(summary.dots).toHaveLength(1);
    expect(summary.overflowCount).toBe(2);
  });
});

describe('getScheduleDotClassName(P28: isBacklog)', () => {
  it('isBacklog면 color/isRecurring과 무관하게 항상 고정 클래스를 쓴다', () => {
    expect(getScheduleDotClassName({ isBacklog: true, color: 'blue', isRecurring: true })).toBe('schedule-day-dot is-backlog');
  });
});
