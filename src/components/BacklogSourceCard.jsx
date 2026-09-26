// P19(P14.2/P17을 이어받음): 등록된 외부 backlog(.json) 소스 하나의 상태 카드. 기존
// BacklogStatusPanel.jsx의 SourceTaskGroups가 하던 일(기준선 회전 요청, 상태별 그룹/이번 주
// 변경 계산)을 그대로 가져오되, 두 가지를 더한다 — (1) 기본은 접힌 요약 행(총 개수 + 이번 주
// 변경 배지)만 보이고 눌러야 상세가 펼쳐진다(백로그가 늘어도 한 화면에 전부 펼쳐지지 않게),
// (2) 자신이 계산한 이번 주 변경분을 onDiffChange로 부모(Backlog.jsx)에 보고해 여러 소스를
// 합친 통합 목록(BacklogWeeklyOverview.jsx)을 만들 수 있게 한다.
import { useEffect, useMemo, useRef, useState } from 'react';
import { getSourceDisplayLabel } from '../lib/backlogSourceMutations.js';
import { useBacklogSourceRead } from '../lib/useBacklogSourceRead.js';
import { getThisWeekRange } from '../lib/dateRange.js';
import { groupTasksByStatus } from '../lib/backlogTaskGrouping.js';
import { resolveWeeklySnapshot, diffWeeklyChanges, countTasksByStatus } from '../lib/backlogWeeklySnapshot.js';

const MAX_TASKS_PER_GROUP = 50;

export default function BacklogSourceCard({ source, onRotateSnapshot, onDiffChange }) {
  const [expanded, setExpanded] = useState(false);
  const state = useBacklogSourceRead(source.path, getThisWeekRange().weekStart);
  const canDiff = state.ok && state.recognized;
  // critical-reviewer 지적(P19 리뷰, Critical): resolveWeeklySnapshot을 렌더마다 그냥 호출하면
  // 기준선이 아직 이번 주 것이 아닐 때(등록 직후, 또는 주가 막 바뀐 시점) 매번 새 객체를
  // 만든다 — 그 객체가 아래 changes(useMemo)를 거쳐 "부모에 보고" effect의 의존값으로 들어가면,
  // 보고 → 부모 setState → 이 컴포넌트 재렌더 → 새 snapshot 객체 → 다시 보고, 로 이어지는
  // 무한 렌더 루프가 된다(저장이 실제로 끝나 source.weekly_snapshot이 갱신돼야만 멈춤). source.
  // weekly_snapshot/state.tasks가 실제로 안 바뀌었으면 같은 참조를 그대로 돌려주도록 메모해
  // 끊는다.
  const snapshot = useMemo(
    () => (canDiff ? resolveWeeklySnapshot(source.weekly_snapshot, state.tasks) : null),
    [canDiff, source.weekly_snapshot, state.tasks]
  );
  const needsRotate = canDiff && snapshot !== source.weekly_snapshot;
  const attemptedWeekStartRef = useRef(null);
  // critical-reviewer 지적(P19 리뷰, Critical) 수정 과정에서 자체 발견한 회귀: 위 snapshot을
  // 메모하고 onRotateSnapshot(handleRotateSnapshot)도 useCallback으로 고정하고 나니(둘 다
  // 렌더 루프/불필요한 재시도를 막으려던 정당한 수정), 두 소스가 동시에 기준선을 새로
  // 만들어야 할 때 mutex에 밀려 건너뛴(attempted:false) 쪽이 다시는 재시도되지 않는 문제가
  // 생겼다 — P17 당시엔 onRotateSnapshot이 매 렌더 새 참조였던 "우연한 불안정성" 덕에 다른
  // 소스의 저장이 끝나 재렌더될 때마다 이 effect가 같이 다시 불려 자연스럽게 재시도됐었는데,
  // 참조를 고정하자 그 부수효과에 의존하던 재시도 경로 자체가 사라졌다(Playwright로 재현:
  // 소스 2개를 동시에 첫 확인하면 하나는 영영 weekly_snapshot이 null로 남았다). 이제는
  // 명시적으로 재시도한다 — 건너뛴 경우 retryTick을 짧은 지연 후 올려 이 effect를 강제로 다시
  // 돌게 한다.
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!needsRotate) return undefined;
    if (attemptedWeekStartRef.current === snapshot.weekStart) return undefined;
    let cancelled = false;
    let retryTimer = null;
    onRotateSnapshot(source.id, snapshot).then((attempted) => {
      if (cancelled) return;
      if (attempted) {
        attemptedWeekStartRef.current = snapshot.weekStart;
      } else {
        retryTimer = setTimeout(() => {
          if (!cancelled) setRetryTick((t) => t + 1);
        }, 150);
      }
    });
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [needsRotate, source.id, snapshot, onRotateSnapshot, retryTick]);

  // snapshot/state.tasks가 실제로 바뀔 때만 새 참조를 만든다 — 매 렌더 새 객체를 주면 아래
  // "부모에 보고" effect가 렌더마다 다시 불려 불필요하게 통합 목록을 흔든다.
  const changes = useMemo(
    () => (canDiff ? diffWeeklyChanges(snapshot, state.tasks) : null),
    [canDiff, snapshot, state.tasks]
  );

  const label = getSourceDisplayLabel(source);

  // critical-reviewer 지적(P19 리뷰, Medium): 의존값을 source 객체 전체로 두면 이 소스와
  // 무관한 필드(예: path)가 안 바뀌어도 새 객체 참조일 때마다(부모가 다른 이유로 배열을 통째로
  // 새로 만들 때) 다시 불린다 — 실제로 보고 내용에 쓰는 값(id, label)만 의존값으로 좁힌다.
  useEffect(() => {
    if (!changes) {
      onDiffChange(source.id, null);
      return undefined;
    }
    onDiffChange(source.id, { label, ...changes });
    // 언마운트(소스 삭제 등)되면 통합 목록에서도 이 소스의 항목을 지운다.
    return () => onDiffChange(source.id, null);
  }, [source.id, label, changes, onDiffChange]);

  if (state.loading) {
    return (
      <div className="backlog-status-source">
        <h3 className="backlog-status-source-title">{label}</h3>
        <p className="backlog-source-status">확인 중...</p>
      </div>
    );
  }
  if (!state.ok) {
    return (
      <div className="backlog-status-source">
        <h3 className="backlog-status-source-title">{label}</h3>
        <p className="backlog-source-status is-error">{state.error}</p>
      </div>
    );
  }
  if (!state.recognized) {
    return (
      <div className="backlog-status-source">
        <h3 className="backlog-status-source-title">{label}</h3>
        <p className="backlog-source-status is-warn">인식 가능한 task 배열을 찾지 못했습니다.</p>
      </div>
    );
  }
  if (state.tasks.length === 0) {
    return (
      <div className="backlog-status-source">
        <h3 className="backlog-status-source-title">{label}</h3>
        <p className="empty-text">
          {state.skippedCount > 0
            ? `표시할 task가 없습니다(id 없는 항목 ${state.skippedCount}개는 제외됨).`
            : '등록된 task가 없습니다.'}
        </p>
      </div>
    );
  }

  const groups = groupTasksByStatus(state.tasks);
  const counts = countTasksByStatus(state.tasks);
  const hasChanges = changes.added.length > 0 || changes.statusChanged.length > 0 || changes.removed.length > 0;
  const totalChangeCount = changes.added.length + changes.statusChanged.length + changes.removed.length;

  return (
    <div className="backlog-status-source">
      <button
        type="button"
        className="backlog-source-summary-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="backlog-status-source-title">{label}</span>
        <span className="backlog-source-summary-counts">
          <span className="backlog-source-summary-count-text">총 {state.tasks.length}개</span>
          {totalChangeCount > 0 && <span className="card-count-badge">이번 주 변경 {totalChangeCount}</span>}
        </span>
        <span className="backlog-source-summary-caret" aria-hidden="true">
          {expanded ? '▲' : '▼'}
        </span>
      </button>
      {expanded && (
        <div className="backlog-source-detail">
          {state.skippedCount > 0 && (
            <p className="backlog-source-status is-warn">id 없는 항목 {state.skippedCount}개는 제외되었습니다.</p>
          )}
          <p className="backlog-weekly-summary">
            총 {state.tasks.length}개 · {counts.map((c) => `${c.status} ${c.count}`).join(' · ')}
          </p>
          <div className="backlog-weekly-changes">
            <h4 className="backlog-status-group-title">이번 주 변경 사항</h4>
            {hasChanges ? (
              <ul className="card-list">
                {changes.added.slice(0, MAX_TASKS_PER_GROUP).map((t, i) => (
                  <li key={`added-${t.id}-${i}`} className="backlog-status-task-row">
                    <span className="backlog-status-task-title">+ 새로 추가: {t.title}</span>
                    <span className="backlog-status-task-owner">{t.status}</span>
                  </li>
                ))}
                {changes.statusChanged.slice(0, MAX_TASKS_PER_GROUP).map((t, i) => (
                  <li key={`changed-${t.id}-${i}`} className="backlog-status-task-row">
                    <span className="backlog-status-task-title">
                      ↻ 상태 변경: {t.title} ({t.previousStatus} → {t.status})
                    </span>
                  </li>
                ))}
                {changes.removed.slice(0, MAX_TASKS_PER_GROUP).map((t, i) => (
                  <li key={`removed-${t.id}-${i}`} className="backlog-status-task-row">
                    <span className="backlog-status-task-title">− 사라짐: {t.title}</span>
                  </li>
                ))}
                {(changes.added.length > MAX_TASKS_PER_GROUP ||
                  changes.statusChanged.length > MAX_TASKS_PER_GROUP ||
                  changes.removed.length > MAX_TASKS_PER_GROUP) && (
                  <li className="backlog-status-task-row">
                    <span className="backlog-status-task-title">(각 항목 최대 {MAX_TASKS_PER_GROUP}개까지만 표시)</span>
                  </li>
                )}
              </ul>
            ) : (
              <p className="empty-text">이번 주 변경 사항 없음.</p>
            )}
          </div>
          <ul className="backlog-status-groups">
            {groups.map((g) => (
              <li key={g.status} className="backlog-status-group">
                <h4 className="backlog-status-group-title">
                  <span className="backlog-status-group-title-text">{g.status}</span>
                  <span className="card-count-badge">{g.tasks.length}</span>
                </h4>
                <ul className="card-list">
                  {g.tasks.slice(0, MAX_TASKS_PER_GROUP).map((t, i) => (
                    <li key={`${t.id}-${i}`} className="backlog-status-task-row">
                      <span className="backlog-status-task-title">{t.title}</span>
                      {t.owner && <span className="backlog-status-task-owner">{t.owner}</span>}
                    </li>
                  ))}
                </ul>
                {g.tasks.length > MAX_TASKS_PER_GROUP && (
                  <p className="backlog-source-status">외 {g.tasks.length - MAX_TASKS_PER_GROUP}개</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
