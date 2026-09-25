// Projects.jsx(P2.2~P2.4)에서 분리 — 데이터 로딩/저장은 여전히 Projects.jsx(부모)가
// useAppData/window.api.saveData로 담당하고, 이 파일은 레이아웃 + 로컬 폼 상태만 다룬다
// (핸들러는 전부 props로 받는다). 요약 카드의 수정/삭제 폼은 ProjectEditForm.jsx로 더 분리돼
// 있다(critical-reviewer 지적: 이 파일이 max-lines 300에 근접했었음).
import { useState } from 'react';
import TodoRow from './TodoRow.jsx';
import { EditProjectForm, DeleteProjectButton } from './ProjectEditForm.jsx';
import DueDatePicker from './DueDatePicker.jsx';

function AddTodoForm({ onAdd }) {
  const [title, setTitle] = useState('');
  // P12.5: 마감일을 바로 선택할 수 있게 함(선택 입력, 비워도 됨) — 제목 입력 후 Enter로 즉시
  // 추가되는 기존 흐름(P2.3 done_when)은 그대로 유지한다. critical-reviewer 지적(재검증):
  // 날짜 입력(type=date)은 HTML 표준상 암묵적 제출(submit 버튼 없이 Enter만으로 제출되는
  // 동작)을 막는 필드라, 제목+날짜 두 입력만 있는 이 폼에서 날짜 입력에 포커스를 두고
  // Enter를 누르면 실제로 제출되지 않았다(Playwright로 재현 확인) — 화면에는 안 보이는 submit
  // 버튼을 둬 어느 입력에 포커스가 있어도 Enter로 항상 제출되게 한다. P12.19(critical-reviewer
  // 지적으로 근거 정정): 날짜 입력이 DueDatePicker(버튼 트리거)로 바뀌면서, 암묵적 제출을
  // 막는 필드는 이제 제목(text) 하나뿐이다 — HTML 표준상 그 경우엔 이 숨은 버튼이 없어도
  // 제목 필드에서 Enter 제출이 원래 된다. 다만 이 버튼을 없애도 얻는 게 없고(있어도 무해),
  // 트리거에 포커스가 있을 때 Enter가 팝오버를 여는 것과 별개로 방어적으로 남겨 둔다.
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = title.trim();
    if (saving) return;
    if (!trimmed) {
      setSaveError('할일 제목을 입력하세요.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await onAdd(trimmed, dueDate || null);
      setTitle('');
      setDueDate('');
    } catch (err) {
      // 내부 예외 메시지(파일 경로 등)를 화면에 그대로 노출하지 않는다 — 콘솔에는 남긴다.
      console.error('할일 저장 실패:', err);
      setSaveError('할일을 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="todo-add-form" onSubmit={handleSubmit}>
      <div className="project-edit-row">
        <input
          type="text"
          className="todo-add-input"
          placeholder="새 할일 입력 후 Enter"
          value={title}
          readOnly={saving}
          onChange={(e) => {
            setTitle(e.target.value);
            if (saveError) setSaveError(null);
          }}
        />
        <DueDatePicker value={dueDate} onChange={setDueDate} disabled={saving} />
      </div>
      <button type="submit" className="visually-hidden" disabled={saving}>
        추가
      </button>
      {saveError && <p className="data-issue-notice">{saveError}</p>}
    </form>
  );
}

function ProjectMemoItem({ memo }) {
  const hasContent = typeof memo.content === 'string' && memo.content !== '';
  return (
    <li className="project-memo-item">
      <div className="project-memo-title">{memo.title || '(제목 없음)'}</div>
      {hasContent && <div className="project-memo-preview">{memo.content}</div>}
    </li>
  );
}

export default function ProjectDetail({
  project,
  todos,
  todoDroppedCount,
  memos,
  memoDroppedCount,
  onBack,
  onAddTodo,
  onSaveProject,
  onDeleteProject,
}) {
  const [editing, setEditing] = useState(false);

  return (
    <>
      <h1>{project.name}</h1>
      <button className="back-button" onClick={onBack}>
        ← 프로젝트 목록
      </button>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">요약</h2>
          {!editing && (
            <button type="button" className="project-edit-toggle" onClick={() => setEditing(true)}>
              수정
            </button>
          )}
        </div>
        {editing ? (
          <EditProjectForm
            project={project}
            onCancel={() => setEditing(false)}
            onSave={async (updates) => {
              await onSaveProject(updates);
              setEditing(false);
            }}
          />
        ) : (
          <>
            <p className="project-progress-summary">
              {project.type ?? '미분류'} · {project.status} · 진행률 {project.progress}%
              {project.due_date ? ` · 마감 ${project.due_date}` : ''}
            </p>
            {project.description && <p className="project-memo-preview">{project.description}</p>}
            <DeleteProjectButton
              onDelete={onDeleteProject}
              todos={todos}
              memos={memos}
              hiddenCount={todoDroppedCount + memoDroppedCount}
            />
          </>
        )}
      </div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">할일</h2>
          <span className="card-count-badge">{todos.length}</span>
        </div>
        {editing ? (
          // 요약 카드 수정 저장과 겹쳐 실행되면 useAppData의 낙관적 갱신(단일 저장 호출 지점 전제,
          // useAppData.js 주석 참고)이 둘 중 먼저 끝난 저장을 나중 저장으로 덮어써버릴 수 있어(
          // critical-reviewer 지적), 수정 중에는 이 폼을 숨겨 두 저장이 겹치는 경로 자체를 막는다.
          <p className="empty-text">요약 수정을 마치거나 취소한 뒤 할일을 추가할 수 있습니다.</p>
        ) : (
          <AddTodoForm onAdd={onAddTodo} />
        )}
        {todoDroppedCount > 0 && (
          <p className="data-issue-notice">
            id 없는 할일 {todoDroppedCount}개는 목록에 표시되지 않습니다 (data.json 확인 필요)
          </p>
        )}
        {todos.length === 0 ? (
          <p className="empty-text">이 프로젝트에 등록된 할일이 없습니다.</p>
        ) : (
          <ul className="card-list">
            {todos.map((t) => (
              <TodoRow key={t.id} todo={t} showDate />
            ))}
          </ul>
        )}
      </div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">메모</h2>
          <span className="card-count-badge">{memos.length}</span>
        </div>
        <p className="project-memo-hint">메모 추가/편집은 메모 화면에서 합니다.</p>
        {memoDroppedCount > 0 && (
          <p className="data-issue-notice">
            id 없는 메모 {memoDroppedCount}개는 목록에 표시되지 않습니다 (data.json 확인 필요)
          </p>
        )}
        {memos.length === 0 ? (
          <p className="empty-text">이 프로젝트에 등록된 메모가 없습니다.</p>
        ) : (
          <ul className="project-memo-list">
            {memos.map((m) => (
              <ProjectMemoItem key={m.id} memo={m} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
