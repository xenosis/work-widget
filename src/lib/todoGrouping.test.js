import { describe, it, expect, afterEach, vi } from 'vitest';
import { groupTodosByDate } from './todoGrouping.js';

describe('groupTodosByDate (시스템 시각 2026-09-17 목요일 고정 — 이번주는 09-14~09-20)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('오늘/이번주(지난 날짜 포함)/나중(더 지난 것+마감없음+다음주)으로 정확히 나눈다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 17));

    const todos = [
      { id: 't-today', due_date: '2026-09-17', priority: '상' },
      { id: 't-week-past', due_date: '2026-09-15', priority: '하' },
      { id: 't-week-future', due_date: '2026-09-19', priority: '상' },
      { id: 't-later-nextweek', due_date: '2026-09-25', priority: '상' },
      { id: 't-later-nodue', due_date: null, priority: '상' },
      { id: 't-later-oldoverdue', due_date: '2026-09-01', priority: '상' },
    ];

    const { today, week, later } = groupTodosByDate(todos);

    expect(today.map((t) => t.id)).toEqual(['t-today']);
    expect(week.map((t) => t.id)).toEqual(['t-week-past', 't-week-future']);
    expect(later.map((t) => t.id)).toEqual(['t-later-oldoverdue', 't-later-nextweek', 't-later-nodue']);
  });

  it('오늘 그룹은 우선순위로만 정렬한다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 17));

    const todos = [
      { id: 'low', due_date: '2026-09-17', priority: '하' },
      { id: 'high', due_date: '2026-09-17', priority: '상' },
    ];
    const { today } = groupTodosByDate(todos);
    expect(today.map((t) => t.id)).toEqual(['high', 'low']);
  });

  it('이번주/나중 그룹은 날짜 우선, 같으면 우선순위로 정렬한다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 17));

    const todos = [
      { id: 'w-low', due_date: '2026-09-19', priority: '하' },
      { id: 'w-high', due_date: '2026-09-19', priority: '상' },
      { id: 'w-earlier', due_date: '2026-09-18', priority: '하' },
    ];
    const { week } = groupTodosByDate(todos);
    expect(week.map((t) => t.id)).toEqual(['w-earlier', 'w-high', 'w-low']);
  });

  it('id 없는 레코드는 제외하고 droppedCount로 알려준다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 17));

    const todos = [{ due_date: '2026-09-17', priority: '상' }, { id: 't1', due_date: '2026-09-17', priority: '상' }];
    const { today, droppedCount } = groupTodosByDate(todos);
    expect(today.map((t) => t.id)).toEqual(['t1']);
    expect(droppedCount).toBe(1);
  });

  it('완료(completed: true)된 항목도 소속 그룹에 그대로 남는다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 17));

    const todos = [{ id: 't1', due_date: '2026-09-17', priority: '상', completed: true }];
    const { today } = groupTodosByDate(todos);
    expect(today.map((t) => t.id)).toEqual(['t1']);
  });

  it('todos가 배열이 아니어도 방어한다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 17));
    expect(groupTodosByDate(undefined)).toEqual({ today: [], week: [], later: [], droppedCount: 0 });
  });

  it('주 경계(일요일 기준): 이번주 일요일은 이번주, 다음주 일요일은 나중으로 나뉜다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 14)); // 월요일, 이번주 09-13~09-19

    const todos = [
      { id: 'this-week-sunday', due_date: '2026-09-13', priority: '상' },
      { id: 'next-week-sunday', due_date: '2026-09-20', priority: '상' },
    ];
    const { week, later } = groupTodosByDate(todos);
    expect(week.map((t) => t.id)).toEqual(['this-week-sunday']);
    expect(later.map((t) => t.id)).toEqual(['next-week-sunday']);
  });

  it('빈 문자열/형식이 잘못된 due_date는 마감일 없음과 동일하게 나중으로 간다(이번주로 오분류되지 않음)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 17));

    const todos = [
      { id: 't-empty', due_date: '', priority: '상' },
      { id: 't-malformed', due_date: '2026-9-18', priority: '상' }, // 0패딩 없음
    ];
    const { today, week, later } = groupTodosByDate(todos);
    expect(today).toEqual([]);
    expect(week).toEqual([]);
    expect(later.map((t) => t.id).sort()).toEqual(['t-empty', 't-malformed']);
  });
});
