// P26: 등록된 backlog(.json) 소스 하나에 대해 "생성" 버튼 + 로딩 + 결과(마지막 생성 시각,
// 복사 가능)를 보여주는 행. BacklogSourceCard.jsx와 같은 방식으로 useBacklogSourceRead +
// resolveWeeklySnapshot/diffWeeklyChanges를 재사용해 weekData(added/statusChanged/removed)를
// 구한다 — 다만 이 화면은 기준선을 새로 저장(rotate)하지 않는다(그건 백로그 탭의 역할, B3.5
// 참고). 여기서는 "지금 기준으로 계산하면 이렇게 나온다"는 값을 codex 프롬프트에 쓸 뿐이다.
import { useState } from 'react';
import { getSourceDisplayLabel } from '../lib/backlogSourceMutations.js';
import { useBacklogSourceRead } from '../lib/useBacklogSourceRead.js';
import { getThisWeekRange } from '../lib/dateRange.js';
import { resolveWeeklySnapshot, diffWeeklyChanges } from '../lib/backlogWeeklySnapshot.js';

// P25 IPC가 돌려주는 code별로 사람이 읽을 안내 문구를 앞에 붙인다 — message 원문(codex의
// 실제 stderr 등)은 그 뒤에 그대로 이어붙여 사람이 원인을 더 자세히 볼 수 있게 한다.
function describeError(result) {
  const prefix =
    {
      NOT_INSTALLED: 'codex CLI가 설치되어 있지 않은 것 같습니다.',
      AUTH_ERROR: 'codex 로그인/인증에 문제가 있는 것 같습니다.',
      TIMEOUT: '응답 시간이 너무 오래 걸려 중단했습니다.',
    }[result.code] || '생성에 실패했습니다.';
  return result.message ? `${prefix} (${result.message})` : prefix;
}

function formatGeneratedAt(isoString) {
  try {
    return new Date(isoString).toLocaleString('ko-KR');
  } catch {
    return isoString;
  }
}

export default function WeeklyReportSourceRow({ source, exampleSentence, onSaveReport }) {
  const state = useBacklogSourceRead(source.path, getThisWeekRange().weekStart);
  const canDiff = state.ok && state.recognized;
  const label = getSourceDisplayLabel(source);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);
  const [copied, setCopied] = useState(false);
  // 자체 발견: 이 화면은 기준선을 저장하지 않으므로(백로그 탭의 역할), 이번 주 들어 백로그
  // 탭을 한 번도 안 열어 weekly_snapshot이 아직 없거나 지난 주 것이면 resolveWeeklySnapshot이
  // "지금 상태 = 기준선"으로 계산해 diff가 전부 비어 보인다(실제로는 변화가 있어도 "변경 없음"
  // 으로 codex에 전달됨) — 조용히 틀리지 않도록 그 상태를 사람에게 보여준다.
  const needsBaseline = canDiff && resolveWeeklySnapshot(source.weekly_snapshot, state.tasks) !== source.weekly_snapshot;

  async function handleGenerate() {
    if (generating || !canDiff) return;
    setGenerating(true);
    setGenerateError(null);
    setCopied(false);
    try {
      // critical-reviewer 지적(High): state.tasks는 이 행이 마운트될 때(또는 주가 바뀔 때)만
      // 읽는다 — 트레이에 며칠 띄워둔 채 그대로 있다가 "생성"을 누르면 그 오래된 tasks로
      // weekData를 만들어, 그 사이의 실제 변화가 빠진 보고서가 조용히 만들어진다("이번 주
      // 변화 보고"라는 목적과 정면으로 부딪힘). 생성 직전에 항상 한 번 더 실제 파일을 읽는다.
      const fresh = await window.api.readBacklogSourceTasks(source.path);
      if (!fresh.ok) {
        setGenerateError(`최신 상태를 다시 읽지 못했습니다. (${fresh.error})`);
        return;
      }
      const snapshot = resolveWeeklySnapshot(source.weekly_snapshot, fresh.tasks);
      const weekData = diffWeeklyChanges(snapshot, fresh.tasks);
      const result = await window.api.generateWeeklyReport({ sourceLabel: label, exampleSentence, weekData });
      if (result.ok) {
        await onSaveReport(source.id, { weekStart: snapshot.weekStart, text: result.text, generated_at: new Date().toISOString() });
      } else {
        setGenerateError(describeError(result));
      }
    } catch (err) {
      // window.api.generateWeeklyReport 자체는 reject하지 않는 계약이지만(P25), onSaveReport의
      // saveData 실패 등 다른 원인으로 여기까지 예외가 올 수 있어 방어적으로 잡는다.
      setGenerateError(`생성에 실패했습니다. (${err && err.message ? err.message : String(err)})`);
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!source.weekly_report?.text) return;
    try {
      await navigator.clipboard.writeText(source.weekly_report.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setGenerateError('클립보드 복사에 실패했습니다.');
    }
  }

  return (
    <div className="weekly-report-source-row">
      <div className="weekly-report-source-header">
        <h3 className="weekly-report-source-title">{label}</h3>
        <button type="button" className="weekly-report-generate-btn" onClick={handleGenerate} disabled={generating || !canDiff}>
          {generating ? '생성 중...' : '생성'}
        </button>
      </div>
      {state.loading && <p className="backlog-source-status">확인 중...</p>}
      {!state.loading && !state.ok && <p className="backlog-source-status is-error">{state.error}</p>}
      {!state.loading && state.ok && !state.recognized && (
        <p className="backlog-source-status is-warn">인식 가능한 task 배열을 찾지 못해 생성할 수 없습니다.</p>
      )}
      {needsBaseline && (
        <p
          className="data-issue-notice"
          title="지금 백로그 탭을 열어도 이번 생성의 변경 내역은 이미 비어 있습니다 — 그 순간부터 다음 생성부터 반영됩니다."
        >
          {/* critical-reviewer 지적(Medium): "백로그 탭을 먼저 열면 지금 생성에 도움이 된다"는
              인상을 주는 문구는 사실과 다르다 — 백로그 탭을 여는 순간 기준선이 "지금 상태"로
              저장되므로 그 직후 생성해도 diff는 똑같이 비어 있다(도움은 다음 생성부터). */}
          이번 주 기준선이 없어 지금 생성하면 변경 내역이 비어 있을 수 있습니다(백로그 탭을 열면
          그 순간부터 다음 생성부터 정확한 변경 내역이 반영됩니다).
        </p>
      )}
      {generateError && <p className="data-issue-notice">{generateError}</p>}
      {source.weekly_report?.text ? (
        <div className="weekly-report-result">
          <div className="weekly-report-result-meta">
            <span>마지막 생성: {formatGeneratedAt(source.weekly_report.generated_at)}</span>
            <button type="button" className="weekly-report-copy-btn" onClick={handleCopy}>
              {copied ? '복사됨' : '복사'}
            </button>
          </div>
          <p className="weekly-report-result-text">{source.weekly_report.text}</p>
        </div>
      ) : (
        !generating && <p className="empty-text">아직 생성된 주간보고가 없습니다.</p>
      )}
    </div>
  );
}
