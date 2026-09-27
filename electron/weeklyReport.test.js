import { describe, it, expect } from 'vitest';
import { buildPrompt, generateWeeklyReport, isLikelyAuthError } from './weeklyReport.js';

// buildPrompt는 fs/child_process를 쓰지 않는 순수 함수라 vitest로 문구 조합만 검증한다.
// 실제 codex exec 왕복(설치 확인/타임아웃/실제 텍스트 생성)은 이 테스트 범위가 아니다 —
// P25 done_when이 요구하는 실제 codex exec 호출 1~2회로 별도 확인한다.
describe('buildPrompt', () => {
  it('예시 문장이 없으면 그 블록 자체를 넣지 않는다', () => {
    const prompt = buildPrompt({ exampleSentence: '', sourceLabel: '내 프로젝트', weekData: {} });
    expect(prompt).not.toContain('참고할 문체');
  });

  it('예시 문장이 있으면 그대로 포함한다', () => {
    const prompt = buildPrompt({ exampleSentence: '이번 주는 A를 완료했습니다.', sourceLabel: '내 프로젝트', weekData: {} });
    expect(prompt).toContain('이번 주는 A를 완료했습니다.');
  });

  it('sourceLabel이 없으면 자리표시자를 쓴다', () => {
    const prompt = buildPrompt({ weekData: {} });
    expect(prompt).toContain('(이름 없음)');
  });

  it('added/statusChanged/removed가 모두 비어 있으면 각각 (없음)으로 표시한다', () => {
    const prompt = buildPrompt({ sourceLabel: 'X', weekData: { added: [], statusChanged: [], removed: [] } });
    expect(prompt.match(/\(없음\)/g)).toHaveLength(3);
  });

  it('added 항목은 제목/상태/담당자를 줄로 나열한다', () => {
    const prompt = buildPrompt({
      sourceLabel: 'X',
      weekData: { added: [{ id: 't1', title: '새 기능', status: 'todo', owner: '홍길동' }] },
    });
    expect(prompt).toContain('- [todo] 새 기능 (담당: 홍길동)');
  });

  it('statusChanged 항목은 이전 상태 -> 현재 상태로 표시한다', () => {
    const prompt = buildPrompt({
      sourceLabel: 'X',
      weekData: { statusChanged: [{ id: 't2', title: '버그 수정', status: 'done', previousStatus: 'in_progress', owner: null }] },
    });
    expect(prompt).toContain('- [in_progress -> done] 버그 수정');
  });

  it('담당자가 없으면 담당자 표시를 생략한다', () => {
    const prompt = buildPrompt({ sourceLabel: 'X', weekData: { removed: [{ id: 't3', title: '삭제됨', status: 'todo', owner: null }] } });
    expect(prompt).toContain('- [todo] 삭제됨');
    expect(prompt).not.toContain('삭제됨 (담당');
  });

  it('weekData가 아예 없어도 죽지 않고 (없음) 3개짜리 프롬프트를 만든다', () => {
    const prompt = buildPrompt({ sourceLabel: 'X' });
    expect(prompt.match(/\(없음\)/g)).toHaveLength(3);
  });

  // critical-reviewer 지적(Medium): 외부 backlog(.json)에서 온 task 배열에 null/객체 아닌
  // 원소가 섞여 있어도(이 프로젝트가 형식을 통제 못 함, B3.5) 죽지 않고 그 원소만 걸러야 한다.
  it('task 배열에 null/객체 아닌 원소가 섞여 있어도 죽지 않고 걸러낸다', () => {
    const prompt = buildPrompt({
      sourceLabel: 'X',
      weekData: { added: [{ id: 't1', title: '정상', status: 'todo', owner: null }, null, 'x', 123] },
    });
    expect(prompt).toContain('[새로 추가된 항목 1개]');
    expect(prompt).toContain('- [todo] 정상');
  });
});

describe('isLikelyAuthError', () => {
  it('인증 관련 영문 키워드가 있으면 인증 오류로 판단한다', () => {
    expect(isLikelyAuthError('Error: not logged in. Run `codex login` first.')).toBe(true);
    expect(isLikelyAuthError('401 Unauthorized')).toBe(true);
  });

  it('인증과 무관한 오류 텍스트는 인증 오류로 판단하지 않는다', () => {
    expect(isLikelyAuthError('network timeout while connecting')).toBe(false);
    expect(isLikelyAuthError('')).toBe(false);
  });
});

// generateWeeklyReport 자체(child_process/codex 호출)는 fs/실제 프로세스를 쓰므로 여기서
// mocking하지 않는다(done_when이 요구하는 실제 codex exec 호출로 별도 검증) — 여기서는
// "예외 없이 항상 {ok:false,...} 형태로 돌아온다"는 계약만, null payload로 확인한다
// (critical-reviewer 지적, Medium: 예전엔 buildPrompt 호출이 try/catch 밖에 있어 잘못된
// payload가 IPC reject로 이어질 수 있었다).
describe('generateWeeklyReport', () => {
  it('payload가 null이어도 reject하지 않고 ok:false를 돌려준다', async () => {
    const result = await generateWeeklyReport(null, { timeoutMs: 1 });
    expect(result.ok).toBe(false);
  });
});
