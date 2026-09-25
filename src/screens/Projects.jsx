// B2.1: 프로젝트 목록(장기/단기 카드) + 상세(할일/메모/진행률)
// P2.1: 장기/단기 구분 카드 목록. P2.2: 카드 클릭 시 상세 화면(라우팅/레이아웃 + 소속 할일
// 목록)으로 전환 — 진행률/마감일 요약도 이미 여기서 함께 보여준다. P2.3: 상세화면 내 할일
// 인라인 추가(이 앱의 첫 data.json 쓰기 경로 — B4.3 프로젝트 상태 자동전환도 함께 반영).
// P2.4: 소속 메모 목록 표시(읽기 전용, 메모 자체는 아직 P4.2 전). P2.5: 프로젝트 생성/수정/
// 삭제(CRUD) — ProjectCard/ProjectDetail을 src/components/로 분리해 이 파일은 데이터
// 로딩·저장과 목록 화면 레이아웃만 담당(eslint max-lines 여유 확보 목적도 있음). 별도
// 라우터 없이 App.jsx의 화면 전환과 같은 방식(로컬 state로 뷰 스위치)을 씀.
import { useState } from 'react';
import { groupProjectsByType } from '../lib/projectGrouping.js';
import { getTodosForProject } from '../lib/projectTodos.js';
import { getMemosForProject } from '../lib/projectMemos.js';
import { useAppData } from '../lib/useAppData.js';
import { compareByDueDateThenPriority } from '../lib/priority.js';
import { createTodo } from '../lib/todoFactory.js';
import { createProject } from '../lib/projectFactory.js';
import { applyProjectUpdate, removeProjectCascade } from '../lib/projectMutations.js';
import { applyProjectStatusForTodos } from '../lib/todoMutations.js';
import ProjectCard from '../components/ProjectCard.jsx';
import ProjectDetail from '../components/ProjectDetail.jsx';

const PROJECT_TYPES = ['장기', '단기'];

function AddProjectForm({ onAdd, defaultType }) {
  const [name, setName] = useState('');
  const [type, setType] = useState(defaultType);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onAdd(trimmed, type);
      setName('');
    } catch (err) {
      console.error('프로젝트 저장 실패:', err);
      setSaveError('프로젝트를 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="project-add-form" onSubmit={handleSubmit}>
      <input
        type="text"
        className="todo-add-input"
        placeholder="새 프로젝트명 입력"
        value={name}
        readOnly={saving}
        onChange={(e) => {
          setName(e.target.value);
          if (saveError) setSaveError(null);
        }}
      />
      <select value={type} disabled={saving} onChange={(e) => setType(e.target.value)}>
        {PROJECT_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <button type="submit" className="project-edit-save" disabled={saving}>
        추가
      </button>
      {saveError && <p className="data-issue-notice">{saveError}</p>}
    </form>
  );
}

export default function Projects() {
  const { apiAvailable, data, error, setData } = useAppData();
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  // P2.6: Part A 5.1 "단기 프로젝트만 별도로 모아서 볼 수 있는 뷰 필요" — Todos.jsx의 완료 항목
  // 숨기기와 같은 패턴(단일 버튼이 자기 라벨을 상태에 따라 바꿈). 켜지면 미분류/장기 섹션을
  // 숨기고 단기 섹션만 남긴다. 새 프로젝트 추가 폼은 필터와 무관한 전역 액션이라 항상 노출한다.
  const [showShortOnly, setShowShortOnly] = useState(false);

  if (!apiAvailable) {
    return (
      <>
        <h1>프로젝트</h1>
        <div className="empty-state-card">
          <p>window.api를 사용할 수 없습니다 (Electron 렌더러 밖에서 실행 중).</p>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <h1>프로젝트</h1>
        <div className="empty-state-card">
          <p>데이터를 불러오지 못했습니다: {error}</p>
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <h1>프로젝트</h1>
        <div className="empty-state-card">
          <p>불러오는 중...</p>
        </div>
      </>
    );
  }

  const { long, short, other } = groupProjectsByType(data.projects, data.todos);

  // B2.1 "별도 팝업 없이 입력창에서 바로 타이핑해서 추가" — createTodo(todoFactory.js)가 B3.2
  // 스키마를 채운다. B4.3(완료 상태 프로젝트에 할일이 추가되면 자동으로 "진행중")도 함께 반영.
  async function handleAddTodo(projectId, title) {
    const nextTodos = [...data.todos, createTodo(projectId, title)];
    const nextProjects = applyProjectStatusForTodos(data.projects, projectId, nextTodos);
    const newData = { ...data, todos: nextTodos, projects: nextProjects };
    await window.api.saveData(newData);
    setData(newData);
  }

  async function handleAddProject(name, type) {
    const nextProjects = [...data.projects, createProject(name, type)];
    const newData = { ...data, projects: nextProjects };
    await window.api.saveData(newData);
    setData(newData);
  }

  async function handleSaveProject(projectId, updates) {
    const nextProjects = applyProjectUpdate(data.projects, projectId, updates, data.todos);
    const newData = { ...data, projects: nextProjects };
    await window.api.saveData(newData);
    setData(newData);
  }

  // P2.8 결정(사람, 2026-09-24): 소속 todo/memo를 고아로 남기지 않고 cascade 삭제한다 —
  // 삭제 확인 단계(P2.10, ProjectDetail/DeleteProjectButton)에서 무엇이 함께 지워지는지
  // 먼저 보여준 뒤에만 이 함수가 호출된다.
  async function handleDeleteProject(projectId) {
    const { projects: nextProjects, todos: nextTodos, memos: nextMemos } = removeProjectCascade(
      data.projects,
      data.todos,
      data.memos,
      projectId
    );
    const newData = { ...data, projects: nextProjects, todos: nextTodos, memos: nextMemos };
    await window.api.saveData(newData);
    setData(newData);
    setSelectedProjectId(null);
  }

  if (selectedProjectId !== null) {
    const selectedProject = [...long, ...short, ...other].find((p) => p.id === selectedProjectId);
    if (selectedProject) {
      const { todos: projectTodos, droppedCount: todoDroppedCount } = getTodosForProject(
        data.todos,
        selectedProjectId
      );
      const { memos: projectMemos, droppedCount: memoDroppedCount } = getMemosForProject(
        data.memos,
        selectedProjectId
      );
      return (
        <ProjectDetail
          project={selectedProject}
          todos={[...projectTodos].sort(compareByDueDateThenPriority)}
          todoDroppedCount={todoDroppedCount}
          memos={projectMemos}
          memoDroppedCount={memoDroppedCount}
          onBack={() => setSelectedProjectId(null)}
          onAddTodo={(title) => handleAddTodo(selectedProjectId, title)}
          onSaveProject={(updates) => handleSaveProject(selectedProjectId, updates)}
          onDeleteProject={() => handleDeleteProject(selectedProjectId)}
        />
      );
    }
    // 선택된 프로젝트가 그 사이 삭제되면(P2.5) 그냥 목록을 그린다 — 렌더 중 setState는 쓰지 않는다
    // (stale id는 해가 없다: 카드 클릭 시 곧바로 새 id로 덮어써진다).
  }

  return (
    <>
      <h1>프로젝트</h1>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">새 프로젝트</h2>
        </div>
        {/* P2.6 리뷰 지적: 필터가 켜진 상태로 기본값('장기')째 추가하면 화면에서 바로 사라져
            보인다(P2.1에서 고쳤던 "무성 소실"과 같은 결함) — 필터 상태에 맞춰 기본 선택값을
            바꾸고, key로 필터 전환 시 폼을 재초기화한다. */}
        <AddProjectForm
          key={showShortOnly ? 'short' : 'all'}
          onAdd={handleAddProject}
          defaultType={showShortOnly ? '단기' : PROJECT_TYPES[0]}
        />
      </div>
      <button type="button" className="todo-hide-toggle" onClick={() => setShowShortOnly((v) => !v)}>
        {showShortOnly ? '전체 보기' : '단기 프로젝트만 보기'}
      </button>
      {showShortOnly && (long.length > 0 || other.length > 0) && (
        <p className="data-issue-notice">
          장기 {long.length}개{other.length > 0 ? `, 미분류 ${other.length}개` : ''} 숨김
        </p>
      )}
      {!showShortOnly && other.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">미분류 프로젝트</h2>
            <span className="card-count-badge">{other.length}</span>
          </div>
          <p className="data-issue-notice">
            type이 장기/단기가 아닙니다. 상세에서 수정하면 정상 분류로 옮길 수 있습니다.
          </p>
          <ul className="project-card-list">
            {other.map((p) => (
              <ProjectCard key={p.id} project={p} onSelect={setSelectedProjectId} />
            ))}
          </ul>
        </div>
      )}
      {!showShortOnly && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">장기 프로젝트</h2>
            <span className="card-count-badge">{long.length}</span>
          </div>
          {long.length === 0 ? (
            <p className="empty-text">장기 프로젝트가 없습니다.</p>
          ) : (
            <ul className="project-card-list">
              {long.map((p) => (
                <ProjectCard key={p.id} project={p} onSelect={setSelectedProjectId} />
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">단기 프로젝트</h2>
          <span className="card-count-badge">{short.length}</span>
        </div>
        {short.length === 0 ? (
          <p className="empty-text">단기 프로젝트가 없습니다.</p>
        ) : (
          <ul className="project-card-list">
            {short.map((p) => (
              <ProjectCard key={p.id} project={p} onSelect={setSelectedProjectId} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
