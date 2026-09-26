// P19(사람 결정, 2026-09-26): 백로그가 늘어날수록 "이번 주에 전체적으로 뭐가 바뀌었는지"를
// 소스별로 하나씩 펼쳐 봐야 하는 게 불편하다는 피드백 — 각 BacklogSourceCard.jsx가 자신의
// 이번 주 변경분을 Backlog.jsx로 보고하면, 그걸 여기서 하나로 합쳐 보여준다. 사용자의 최종
// 목표(백로그 기반 주간보고를 codex로 자동 작성)를 염두에 두고, 이 통합 목록이 그 입력에 가장
// 가까운 형태가 되도록 소스 이름을 각 항목에 함께 붙인다.
const MAX_ITEMS_PER_KIND = 50;

// critical-reviewer 지적(P19 리뷰, Medium): changesBySource는 일반 객체라 Object.values 순서가
// "어느 소스가 먼저 보고를 마쳤는지"(IPC 읽기 완료 순서, 실행할 때마다 달라질 수 있음)를 따라가
// 아래 BacklogSourceCard.jsx 목록의 순서와 안 맞을 수 있었다 — 부모(Backlog.jsx)가 실제
// 렌더링에 쓰는 소스 순서(sourceOrder)를 그대로 받아 그 순서로 순회한다.
function flatten(changesBySource, sourceOrder, kind) {
  const items = [];
  for (const sourceId of sourceOrder) {
    const entry = changesBySource[sourceId];
    if (!entry) continue;
    for (const t of entry[kind]) items.push({ ...t, sourceLabel: entry.label });
  }
  return items;
}

export default function BacklogWeeklyOverview({ changesBySource, sourceOrder }) {
  const entries = Object.values(changesBySource).filter(Boolean);
  if (entries.length === 0) return null;

  const added = flatten(changesBySource, sourceOrder, 'added');
  const statusChanged = flatten(changesBySource, sourceOrder, 'statusChanged');
  const removed = flatten(changesBySource, sourceOrder, 'removed');
  const hasChanges = added.length > 0 || statusChanged.length > 0 || removed.length > 0;
  const overLimit =
    added.length > MAX_ITEMS_PER_KIND ||
    statusChanged.length > MAX_ITEMS_PER_KIND ||
    removed.length > MAX_ITEMS_PER_KIND;

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">이번 주 전체 변경 사항</h2>
      </div>
      {hasChanges ? (
        <ul className="card-list">
          {added.slice(0, MAX_ITEMS_PER_KIND).map((t, i) => (
            <li key={`added-${i}`} className="backlog-status-task-row">
              <span className="backlog-status-task-title">+ 새로 추가: {t.title}</span>
              <span className="backlog-status-task-owner">{t.sourceLabel}</span>
            </li>
          ))}
          {statusChanged.slice(0, MAX_ITEMS_PER_KIND).map((t, i) => (
            <li key={`changed-${i}`} className="backlog-status-task-row">
              <span className="backlog-status-task-title">
                ↻ 상태 변경: {t.title} ({t.previousStatus} → {t.status})
              </span>
              <span className="backlog-status-task-owner">{t.sourceLabel}</span>
            </li>
          ))}
          {removed.slice(0, MAX_ITEMS_PER_KIND).map((t, i) => (
            <li key={`removed-${i}`} className="backlog-status-task-row">
              <span className="backlog-status-task-title">− 사라짐: {t.title}</span>
              <span className="backlog-status-task-owner">{t.sourceLabel}</span>
            </li>
          ))}
          {overLimit && (
            <li className="backlog-status-task-row">
              <span className="backlog-status-task-title">(각 항목 최대 {MAX_ITEMS_PER_KIND}개까지만 표시)</span>
            </li>
          )}
        </ul>
      ) : (
        <p className="empty-text">이번 주 변경 사항 없음.</p>
      )}
    </div>
  );
}
