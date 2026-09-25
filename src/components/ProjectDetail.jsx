// Projects.jsx(P2.2~P2.4)에서 분리 — 데이터 로딩/저장은 여전히 Projects.jsx(부모)가
// useAppData/window.api.saveData로 담당하고, 이 파일은 레이아웃 + 로컬 폼 상태만 다룬다
// (핸들러는 전부 props로 받는다). 요약 카드의 수정/삭제 폼은 ProjectEditForm.jsx로 더 분리돼
// 있다(critical-reviewer 지적: 이 파일이 max-lines 300에 근접했었음).
import { useState } from 'react';
import TodoRow from './TodoRow.jsx';
import { EditProjectForm, DeleteProjectButton } from './ProjectEditForm.jsx';

function AddTodoForm({ onAdd }) {
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onAdd(trimmed);
      setTitle('');
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
