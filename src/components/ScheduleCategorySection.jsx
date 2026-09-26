// P15(사람 결정, 2026-09-26): 일정 화면 위쪽에 있던 이 카드가 캘린더를 가린다는 피드백으로
// 전용 "설정" 화면(Settings.jsx)으로 옮겼다 — 이제 이 카드만 보러 오는 전용 화면이라 굳이
// 접어둘 이유가 없어져(P12.16 당시 "자주 안 쓰는 기능이라 접어둠" 근거가 더 이상 안 맞음)
// 토글 버튼을 없애고 항상 펼친 채로 보여준다.
import ScheduleCategoryManager from './ScheduleCategoryManager.jsx';
import { getUsableCategories } from '../lib/scheduleCategoryMutations.js';

export default function ScheduleCategorySection({ categories, onAdd, onEdit, onDelete, disabled = false }) {
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">일정 카테고리</h2>
        {/* critical-reviewer 지적(P12.16 재검증 2라운드, Medium): 배지가 필터 전 길이를 쓰고
            ScheduleCategoryManager는 id 없는 레코드를 걸러낸 뒤 그려서, 손상 데이터가 섞이면
            배지 숫자와 실제 행 수가 달랐다 — getUsableCategories로 같은 필터를 공유한다. */}
        <span className="card-count-badge">{getUsableCategories(categories).length}</span>
      </div>
      <ScheduleCategoryManager categories={categories} onAdd={onAdd} onEdit={onEdit} onDelete={onDelete} disabled={disabled} />
    </div>
  );
}
