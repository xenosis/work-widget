import { describe, it, expect } from 'vitest';
import { buildExampleSaveData, buildReportSaveData } from './weeklyReportActions.js';

describe('buildExampleSaveData', () => {
  it('weekly_report_example만 교체하고 나머지 필드는 그대로 둔다', () => {
    const data = { projects: [], weekly_report_example: '' };
    const result = buildExampleSaveData(data, '새 예시 문장');
    expect(result).toEqual({ projects: [], weekly_report_example: '새 예시 문장' });
  });
});

describe('buildReportSaveData', () => {
  it('해당 id의 소스만 weekly_report를 교체하고 나머지 소스는 그대로 둔다', () => {
    const data = {
      backlog_sources: [
        { id: 's1', weekly_report: null },
        { id: 's2', weekly_report: null },
      ],
    };
    const report = { weekStart: '2026-09-21', text: '요약', generated_at: '2026-09-27T00:00:00.000Z' };
    const result = buildReportSaveData(data, 's2', report);
    expect(result.backlog_sources[0].weekly_report).toBeNull();
    expect(result.backlog_sources[1].weekly_report).toEqual(report);
  });

  it('일치하는 id가 없으면 아무 소스도 안 바뀐다', () => {
    const data = { backlog_sources: [{ id: 's1', weekly_report: null }] };
    const result = buildReportSaveData(data, 'nope', { text: 'x' });
    expect(result.backlog_sources).toEqual(data.backlog_sources);
  });
});
