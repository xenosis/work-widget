// P15(사람 결정, 2026-09-26): 일정 화면 위쪽에 있던 이 카드가 캘린더를 가린다는 피드백으로
// 전용 "설정" 화면(Settings.jsx)으로 옮겼다 — 전용 화면이라 접어둘 이유가 없어져 토글 버튼을
// 없애고 항상 펼친 채로 보여준다(ScheduleCategorySection.jsx와 같은 이유).
import BacklogSourceManager from './BacklogSourceManager.jsx';
import { getUsableBacklogSources } from '../lib/backlogSourceMutations.js';

export default function BacklogSourcesSection({ sources, onAdd, onDelete, disabled = false }) {
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">외부 backlog(.json) 소스</h2>
        <span className="card-count-badge">{getUsableBacklogSources(sources).length}</span>
      </div>
      <BacklogSourceManager sources={sources} onAdd={onAdd} onDelete={onDelete} disabled={disabled} />
    </div>
  );
}
