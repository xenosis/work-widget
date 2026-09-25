// ProjectDetail.jsx의 "요약" 카드 수정/삭제 두 폼만 분리 — P2.5 구현 중 ProjectDetail.jsx가
// eslint max-lines(300)에 근접해(critical-reviewer 지적) 여기로 뺐다. 상태/핸들러는 그대로
// 로컬 useState이며, 실제 저장/삭제는 부모가 props로 넘긴 onSave/onDelete가 담당한다.
import { useState } from 'react';

const PROJECT_TYPES = ['장기', '단기'];
const PROJECT_STATUSES = ['진행중', '완료', '보류'];

// P2.5: 요약 카드를 보기/수정 두 모드로 전환. 팝업 없이 같은 카드 안에서 바로 편집하는
// 방식(P2.3의 "별도 팝업 없음" 기조와 통일).
export function EditProjectForm({ project, onSave, onCancel }) {
  const [name, setName] = useState(project.name);
  // 구버전/손상 레코드가 enum 밖 값을 가진 채로 들어와도 <select>가 비제어 상태(value=undefined)로
  // 빠지지 않도록 알려진 값이 아니면 첫 옵션으로 폴백한다(critical-reviewer 지적: 폴백이 없으면
  // "화면엔 첫 옵션이 보이는데 저장 시 그 필드가 통째로 빠지는" 표시-저장 불일치가 생김).
  const [type, setType] = useState(PROJECT_TYPES.includes(project.type) ? project.type : PROJECT_TYPES[0]);
  const [status, setStatus] = useState(
    PROJECT_STATUSES.includes(project.status) ? project.status : PROJECT_STATUSES[0]
  );
  const [dueDate, setDueDate] = useState(project.due_date ?? '');
  const [description, setDescription] = useState(project.description ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave({
        name: trimmed,
        type,
        status,
        due_date: dueDate.trim() || null,
        description: description.trim() || null,
      });
    } catch (err) {
      console.error('프로젝트 저장 실패:', err);
      setSaveError('프로젝트를 저장하지 못했습니다.');
      setSaving(false);
    }
  }

  return (
    <form className="project-edit-form" onSubmit={handleSubmit}>
      <input
        type="text"
        className="todo-add-input"
        value={name}
        disabled={saving}
        onChange={(e) => setName(e.target.value)}
        placeholder="프로젝트명"
      />
      <div className="project-edit-row">
        <select value={type} disabled={saving} onChange={(e) => setType(e.target.value)}>
          {PROJECT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select value={status} disabled={saving} onChange={(e) => setStatus(e.target.value)}>
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dueDate}
          disabled={saving}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>
      <textarea
        className="project-edit-description"
        value={description}
        disabled={saving}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="요약 설명 (선택)"
        rows={2}
      />
      {saveError && <p className="data-issue-notice">{saveError}</p>}
      <div className="project-edit-actions">
        <button type="submit" className="project-edit-save" disabled={saving}>
          저장
        </button>
        <button type="button" className="back-button" disabled={saving} onClick={onCancel}>
          취소
        </button>
      </div>
    </form>
  );
}

// P2.5: 네이티브 confirm() 대신 같은 화면 안에서 2단계로 확인 — 이 앱의 "별도 팝업 없음"
// 기조와 통일되고, 자동화 테스트/키보드 조작도 쉬워진다.
// P2.10(P2.8 결정 구현): 삭제가 소속 todo/memo까지 cascade로 지우므로, 확인 단계에서
// 무엇이 함께 지워지는지 todo/memo 제목 목록으로 미리 보여준다. critical-reviewer 지적:
// 여기 보이는 todos/memos는 getTodosForProject/getMemosForProject가 id 없는 손상 레코드를
// 걸러낸 "유효한" 것만이라 실제 cascade 삭제 범위(project_id만 보고 지움)보다 적게 셀 수
// 있다 — hiddenCount(두 droppedCount의 합)로 그 차이를 함께 알린다.
export function DeleteProjectButton({ onDelete, todos, memos, hiddenCount }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  if (!confirming) {
    return (
      <button type="button" className="project-delete-button" onClick={() => setConfirming(true)}>
        프로젝트 삭제
      </button>
    );
  }

  return (
    <div className="project-delete-confirm">
      <p className="data-issue-notice">
        정말 삭제할까요? 되돌릴 수 없으며, 소속 할일 {todos.length}개·메모 {memos.length}개도 함께
        삭제됩니다{hiddenCount > 0 ? ` (목록에 표시되지 않는 손상 데이터 ${hiddenCount}개도 함께 삭제됩니다)` : ''}.
      </p>
      {todos.length > 0 && (
        <ul className="project-delete-todo-preview">
          {todos.map((t) => (
            <li key={t.id}>{t.title || '(제목 없음)'}</li>
          ))}
        </ul>
      )}
      {memos.length > 0 && (
        <ul className="project-delete-todo-preview">
          {memos.map((m) => (
            <li key={m.id}>{m.title || '(제목 없음)'}</li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="project-delete-button"
        disabled={deleting}
        onClick={async () => {
          setDeleting(true);
          setDeleteError(null);
          try {
            await onDelete();
          } catch (err) {
            console.error('프로젝트 삭제 실패:', err);
            setDeleteError('프로젝트를 삭제하지 못했습니다.');
            setDeleting(false);
          }
        }}
      >
        삭제 확인
      </button>
      <button
        type="button"
        className="back-button"
        disabled={deleting}
        onClick={() => setConfirming(false)}
      >
        취소
      </button>
      {deleteError && <p className="data-issue-notice">{deleteError}</p>}
    </div>
  );
}
