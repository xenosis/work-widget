// B2.2: 오늘/이번주/나중 날짜 그룹핑, 완료해도 취소선으로 유지
// P3.1: 프로젝트 구분과 무관하게 날짜 기준으로만 그룹핑.
// P3.2: 완료 체크(취소선 유지)+숨김 토글. 체크는 TodoRow에 onToggle로 위임하고, 저장은
// todoMutations.js(applyTodoCompletion/applyProjectStatusForTodos)로 처리한다 — 완료 토글이
// 소속 프로젝트 상태(B4.3)까지 함께 바꿀 수 있어 Projects.jsx의 handleAddTodo와 같은 규칙을
// 재사용한다. "숨김"은 레코드를 지우거나 바꾸는 게 아니라 화면 표시만 거르는 로컬 상태다(B3.2에
// hidden류 필드가 없음 — data.json에는 반영하지 않음, work-widget-requirements.md#B2.1의
// "(결정, P3.2)"처럼 화면 전환/새로고침 시 초기화되는 것도 의도한 동작).
// P3.3: 이 화면에서도 할일 추가 가능(프로젝트 선택 필수 — B3.2가 project_id를 nullable이 아닌
// 필수로 규정, TodoAddForm.jsx 참고).
// P3.5: 기존 할일 수정(제목/마감일/우선순위/태그/소속 프로젝트)/삭제. TodoRow가 onEdit/onDelete를
// 받으면 TodoEditForm.jsx로 전환한다 — 수정 폼도 TodoAddForm과 같은 이유로 프로젝트 선택을
// 필수로 강제한다(TodoEditForm.jsx 참고, 고아 todo의 실질적 복구 경로이기도 함).
// saving은 화면 전체에 저장이 하나라도 진행 중인지를 나타내며, 진행 중이면 모든 TodoRow의
// 체크박스와 추가 폼을 disabled로 막는다 — 행마다 따로 자기 저장 여부만 보고 disabled하면, A의
// 저장이 IPC 왕복 중인 사이 B를 조작할 수 있고 나중에 끝난 저장이 먼저 저장을 덮어써 조용히
// 유실되는 경합이 생긴다(critical-reviewer [Critical] 지적 — useAppData.js가 경고한 "저장 호출
// 지점이 여러 개면 위험하다"는 시나리오가 행 개수만큼 열려 있었음). 각 핸들러 진입부의
// `if (saving) return`은 그 방어를 한 번 더 확인하는 안전장치다.
import { useState } from 'react';
import { groupTodosByDate } from '../lib/todoGrouping.js';
import { useAppData } from '../lib/useAppData.js';
import {
  applyTodoCompletion,
  applyProjectStatusForTodos,
  applyTodoUpdate,
  removeTodo,
} from '../lib/todoMutations.js';
import { createTodo } from '../lib/todoFactory.js';
import TodoRow from '../components/TodoRow.jsx';
import TodoAddForm from '../components/TodoAddForm.jsx';

function TodoGroup({ title, todos, projects, emptyText, showDate, onToggle, onEdit, onDelete, disabled }) {
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">{title}</h2>
        <span className="card-count-badge">{todos.length}</span>
      </div>
      {todos.length === 0 ? (
        <p className="empty-text">{emptyText}</p>
      ) : (
        <ul className="card-list">
          {/* B2.2: 완료해도 목록에서 사라지지 않고 취소선으로 남는다(숨김 토글을 켰을 때는 예외). */}
          {todos.map((t) => (
            <TodoRow
              key={t.id}
              todo={t}
              projects={projects}
              showDate={showDate}
              showProject
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
              disabled={disabled}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Todos() {
  const { apiAvailable, data, error, setData } = useAppData();
  const [hideCompleted, setHideCompleted] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!apiAvailable) {
    return (
      <>
        <h1>할일전체</h1>
        <div className="empty-state-card">
          <p>window.api를 사용할 수 없습니다 (Electron 렌더러 밖에서 실행 중).</p>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <h1>할일전체</h1>
        <div className="empty-state-card">
          <p>데이터를 불러오지 못했습니다: {error}</p>
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <h1>할일전체</h1>
        <div className="empty-state-card">
          <p>불러오는 중...</p>
        </div>
      </>
    );
  }

  // B4.3: 완료 상태인 프로젝트에 새 할일이 추가되면 자동으로 "진행중"으로 되돌린다 —
  // Projects.jsx의 handleAddTodo(P2.3)와 동일한 규칙(todoMutations.js 공유). 체크박스 토글과
  // 같은 saving 가드를 재사용해 두 저장 경로(추가/완료토글)가 겹쳐 실행되는 것도 함께 막는다.
  // 가드에 걸리면(이론상으로만 — disabled가 실제 클릭을 먼저 막음) 조용히 성공한 척 리턴하지
  // 않고 던진다 — 호출한 폼이 이미 실패를 표시하고 입력을 보존하는 catch를 갖고 있다
  // (critical-reviewer 지적: 조용히 return하면 호출부가 저장 성공으로 오인해 입력창을 비웠음).
  async function handleAddTodo(title, projectId, dueDate) {
    if (saving) throw new Error('저장이 진행 중입니다. 잠시 후 다시 시도하세요.');
    setSaving(true);
    try {
      const nextTodos = [...data.todos, createTodo(projectId, title, dueDate)];
      const nextProjects = applyProjectStatusForTodos(data.projects, projectId, nextTodos);
      const newData = { ...data, todos: nextTodos, projects: nextProjects };
      await window.api.saveData(newData);
      setData(newData);
    } finally {
      setSaving(false);
    }
  }

  // B4.3: 완료 체크/해제가 소속 프로젝트 상태(모두 완료→자동 완료, 완료 취소→자동 진행중)에도
  // 영향을 준다 — Projects.jsx의 handleAddTodo(P2.3)와 동일한 규칙(todoMutations.js 공유).
  async function handleToggleComplete(todoId, nextCompleted) {
    if (saving) throw new Error('저장이 진행 중입니다. 잠시 후 다시 시도하세요.');
    setSaving(true);
    try {
      const target = data.todos.find((t) => t && t.id === todoId);
      const nextTodos = applyTodoCompletion(data.todos, todoId, nextCompleted);
      const nextProjects = applyProjectStatusForTodos(data.projects, target?.project_id, nextTodos);
      const newData = { ...data, todos: nextTodos, projects: nextProjects };
      await window.api.saveData(newData);
      setData(newData);
    } finally {
      setSaving(false);
    }
  }

  // P3.5: 소속 프로젝트를 바꿀 수도 있으므로(제목/마감일/우선순위/태그와 함께) 이전 프로젝트와
  // 새 프로젝트 양쪽의 B4.3 상태를 재계산한다 — applyProjectStatusForTodos는 projectId가
  // null이거나 상태가 실제로 안 바뀌면 아무것도 건드리지 않으므로, 재배정이 아닌 일반 수정(같은
  // project_id)이어도 안전하게 한 번 더 불러도 된다.
  async function handleEditTodo(todoId, updates) {
    if (saving) throw new Error('저장이 진행 중입니다. 잠시 후 다시 시도하세요.');
    setSaving(true);
    try {
      const target = data.todos.find((t) => t && t.id === todoId);
      const nextTodos = applyTodoUpdate(data.todos, todoId, updates);
      let nextProjects = applyProjectStatusForTodos(data.projects, target?.project_id, nextTodos);
      nextProjects = applyProjectStatusForTodos(nextProjects, updates.project_id, nextTodos);
      const newData = { ...data, todos: nextTodos, projects: nextProjects };
      await window.api.saveData(newData);
      setData(newData);
    } finally {
      setSaving(false);
    }
  }

  // B4.3: 할일을 지우면 소속 프로젝트가 "모두 완료"로 바뀌거나(마지막 미완료 항목을 지운 경우)
  // 할일이 0개가 되어(완료 상태였다면 진행중으로 되돌아감, deriveProjectStatus의 기존 규칙) 상태가
  // 바뀔 수 있다.
  async function handleDeleteTodo(todoId) {
    if (saving) throw new Error('저장이 진행 중입니다. 잠시 후 다시 시도하세요.');
    setSaving(true);
    try {
      const target = data.todos.find((t) => t && t.id === todoId);
      const nextTodos = removeTodo(data.todos, todoId);
      const nextProjects = applyProjectStatusForTodos(data.projects, target?.project_id, nextTodos);
      const newData = { ...data, todos: nextTodos, projects: nextProjects };
      await window.api.saveData(newData);
      setData(newData);
    } finally {
      setSaving(false);
    }
  }

  const { today, week, later, droppedCount } = groupTodosByDate(data.todos);
  const visible = (list) => (hideCompleted ? list.filter((t) => t.completed !== true) : list);
  // 원래는 있었는데 완료돼서 숨김 토글에 걸러진 경우, "마감인 할일이 없다"는 문구가 오해를
  // 부르지 않도록 이유를 구분해서 보여준다.
  const emptyTextFor = (list, baseText) =>
    hideCompleted && list.length > 0 ? '완료된 할일만 있어 숨겨져 있습니다.' : baseText;

  return (
    <>
      <h1>할일전체</h1>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">새 할일</h2>
        </div>
        <TodoAddForm projects={data.projects} onAdd={handleAddTodo} disabled={saving} />
      </div>
      <button type="button" className="todo-hide-toggle" onClick={() => setHideCompleted((v) => !v)}>
        {hideCompleted ? '완료 항목 표시' : '완료 항목 숨기기'}
      </button>
      {droppedCount > 0 && (
        <p className="data-issue-notice">
          id가 없거나 형식이 잘못된 할일 {droppedCount}개는 목록에 표시되지 않습니다 (data.json 확인 필요)
        </p>
      )}
      <TodoGroup
        title="오늘"
        todos={visible(today)}
        projects={data.projects}
        emptyText={emptyTextFor(today, '오늘 마감인 할일이 없습니다.')}
        showDate={false}
        onToggle={handleToggleComplete}
        onEdit={handleEditTodo}
        onDelete={handleDeleteTodo}
        disabled={saving}
      />
      <TodoGroup
        title="이번주"
        todos={visible(week)}
        projects={data.projects}
        emptyText={emptyTextFor(week, '이번주 마감인 할일이 없습니다.')}
        showDate
        onToggle={handleToggleComplete}
        onEdit={handleEditTodo}
        onDelete={handleDeleteTodo}
        disabled={saving}
      />
      <TodoGroup
        title="나중 (지난 마감 포함)"
        todos={visible(later)}
        projects={data.projects}
        emptyText={emptyTextFor(later, '나중 할일이 없습니다.')}
        showDate
        onToggle={handleToggleComplete}
        onEdit={handleEditTodo}
        onDelete={handleDeleteTodo}
        disabled={saving}
      />
    </>
  );
}
