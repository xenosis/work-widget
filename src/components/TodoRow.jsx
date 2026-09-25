// B2.2/B1.2 공용 할일 행. Dashboard.jsx(오늘/이번주)와 Todos.jsx(오늘/이번주/나중), 이제
// Projects.jsx(상세화면 소속 할일)까지 거의 동일한 마크업을 3곳에 복붙하다가 due_date 노출
// 조건이 화면마다 조용히 갈라지기 시작해(P2.2 리뷰 지적) 여기로 추출한다.
// title/project-tag/due-date를 한 줄에 다 넣으면 좁은 창에서 title이 0폭으로 찌그러지는
// 버그(P1.7 자체 검증 중 발견)가 있어 제목 줄과 메타(태그/마감일) 줄을 분리한다.
// P3.2: onToggle을 넘긴 화면(Todos.jsx)에서만 완료 체크박스를 인터랙티브하게 렌더한다 —
// Dashboard.jsx/ProjectDetail.jsx는 이 행에서 완료 처리를 요구하지 않는다(work-widget-requirements.md
// B2.1의 "(결정, P3.2)" 참고 — 완료 체크는 할일전체 화면 전용). checked는 todo.completed를
// 그대로 반영하는 제어 컴포넌트라, 저장이 실패하면 낙관적으로 앞서가지 않고 실제 저장된 값으로
// 자동 복귀한다(단, 저장이 성공해도 IPC 왕복이 끝나야 반영되므로 클릭 직후 짧은 지연이 있을 수
// 있다 — critical-reviewer 지적, 받아들이기로 한 트레이드오프).
// disabled는 화면(Todos.jsx)이 저장 진행 중일 때 모든 행에 동일하게 내려주는 값이다 — 각 행이
// 자기 저장 여부만으로 스스로를 disabled하면, A행 저장이 IPC 왕복 중인 사이 B행을 클릭할 수
// 있어 나중에 끝난 저장이 먼저 저장을 덮어써 조용히 유실되는 경합이 생긴다(critical-reviewer
// [Critical] 지적 — useAppData.js가 경고한 "저장 호출 지점이 여러 개면 위험하다"는 바로 그
// 시나리오). 그래서 in-flight 여부는 화면 하나가 통제하고, 이 컴포넌트는 그 값을 그대로 반영만
// 한다.
// P3.5: onEdit/onDelete를 넘긴 화면(Todos.jsx)에서만 수정/삭제 컨트롤을 렌더한다 — 완료 체크와
// 같은 이유로 다른 화면은 읽기 전용을 유지한다. 삭제는 ProjectDetail의 DeleteProjectButton과
// 같은 위치 규칙(보기 모드에서만 노출, 수정 모드에선 숨김)을 따른다.
import { useState } from 'react';
import { priorityClassName } from '../lib/priority.js';
import { getProjectName } from '../lib/projectLookup.js';
import { TodoEditForm, DeleteTodoButton } from './TodoEditForm.jsx';

export default function TodoRow({
  todo,
  projects,
  showDate = false,
  showProject = false,
  onToggle,
  disabled = false,
  onEdit,
  onDelete,
}) {
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const projectName = showProject ? getProjectName(projects, todo.project_id) : null;
  const hasMeta = Boolean(projectName) || (showDate && Boolean(todo.due_date));
  const isCompleted = todo.completed === true;

  async function handleToggle(e) {
    if (!onToggle || disabled) return;
    setError(null);
    try {
      await onToggle(todo.id, e.target.checked);
    } catch (err) {
      console.error('할일 완료 처리 실패:', err);
      setError('완료 상태를 저장하지 못했습니다.');
    }
  }

  if (editing) {
    return (
      <TodoEditForm
        todo={todo}
        projects={projects}
        disabled={disabled}
        onCancel={() => setEditing(false)}
        onSave={async (updates) => {
          await onEdit(todo.id, updates);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <li className="todo-row">
      {onToggle && (
        <input
          type="checkbox"
          className="todo-checkbox"
          checked={isCompleted}
          disabled={disabled}
          onChange={handleToggle}
          aria-label={`${todo.title || '제목 없는 할일'} 완료 체크`}
        />
      )}
      <span className={`todo-dot ${priorityClassName(todo.priority)}`} />
      <div className="todo-main">
        <span className={`todo-title ${isCompleted ? 'completed' : ''}`}>{todo.title}</span>
        {hasMeta && (
          <div className="todo-meta">
            {projectName && <span className="todo-project-tag">{projectName}</span>}
            {showDate && todo.due_date && <span className="todo-due-date">{todo.due_date}</span>}
          </div>
        )}
        {onEdit && (
          <div className="todo-row-actions">
            <button
              type="button"
              className="todo-edit-toggle"
              disabled={disabled}
              onClick={() => setEditing(true)}
            >
              수정
            </button>
            {onDelete && <DeleteTodoButton onDelete={() => onDelete(todo.id)} disabled={disabled} />}
          </div>
        )}
        {error && <p className="data-issue-notice">{error}</p>}
      </div>
      {todo.priority && (
        <span className={`priority-chip ${priorityClassName(todo.priority)}`}>{todo.priority}</span>
      )}
    </li>
  );
}
