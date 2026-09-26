import { describe, it, expect } from 'vitest';
import { createBacklogSource } from './backlogSourceFactory.js';

const NOW = '2026-09-26T00:00:00.000Z';

describe('createBacklogSource', () => {
  it('path를 그대로 저장하고 label은 null(미지정)로 시작한다', () => {
    const s = createBacklogSource({ path: 'C:/foo/backlog.json' }, NOW);
    expect(s).toMatchObject({
      path: 'C:/foo/backlog.json',
      label: null,
      created_at: NOW,
      updated_at: NOW,
    });
    expect(s.id).toMatch(/^backlog-source-/);
  });
});
