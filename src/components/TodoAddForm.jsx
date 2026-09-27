// Todos.jsx(P3.3)에서 분리 — P3.5(수정/삭제)가 더해지며 화면 파일이 eslint max-lines(300)에
// 근접해 ProjectEditForm.jsx와 같은 이유로 컴포넌트 파일로 뺐다. 로직 변경 없음.
//
// P3.3: B3.2는 todo.project_id를 nullable이 아닌 "항상 존재, 필수"로 규정한다(Memo의
// project_id와 다름 — Memo만 "없으면 전체(독립) 메모"). 그래서 이 화면의 추가 폼은 프로젝트
// 선택을 필수로 요구하고, 선택할 프로젝트가 하나도 없으면 폼 자체를 비활성화한다(빈 값으로
// 제출해 스키마를 어기는 레코드가 생기지 않도록). 초기값을 빈 문자열로 두고 플레이스홀더
// 옵션만 보여줘서 명시적으로 고르게 강제한다 — 첫 번째 프로젝트를 기본값으로 미리 골라두면
// 사용자가 드롭다운을 건드리지 않고도 제출할 수 있어, 의도하지 않은(대개 가장 오래된) 프로젝트에
// 할일이 붙고 그 프로젝트가 "완료" 상태였다면 B4.3에 따라 "진행중"으로도 조용히 되돌아간다 —
// 잘못 붙으면 TodoEditForm.jsx(P3.5)로 나중에 재배정할 수는 있지만, B4.3 자동 전환은 저장 즉시
// 일어나 그 사이 다른 프로젝트 상태를 조용히 바꿔버릴 수 있다(critical-reviewer [Critical] 지적
// — 그래서 기본값을 강제로 비워 최대한 처음부터 막는다).
import { useState } from 'react';
import { getUsableProjects } from '../lib/projectLookup.js';
import DueDatePicker from './DueDatePicker.jsx';

export default function TodoAddForm({ projects, onAdd, disabled }) {
  const usableProjects = getUsableProjects(projects);
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  // P12.5: 마감일을 추가 시점에 바로 선택할 수 있게 함 — 이전엔 없어서 새 할일이 항상 '나중'
  // 그룹에만 들어갔다(B2.2 P3.3 결정 문단). 선택 입력이라 비워도 된다.
  const [dueDate, setDueDate] = useState('');
  const [saveError, setSaveError] = useState(null);
  const hasProjects = usableProjects.length > 0;

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = title.trim();
    if (disabled) return;
    if (!trimmed || !projectId) {
      setSaveError(!trimmed ? '할일 제목을 입력하세요.' : '프로젝트를 선택하세요.');
      return;
    }
    setSaveError(null);
    try {
      await onAdd(trimmed, projectId, dueDate || null);
      setTitle('');
      setProjectId('');
      setDueDate('');
    } catch (err) {
      console.error('할일 저장 실패:', err);
      setSaveError('할일을 저장하지 못했습니다.');
    }
  }

  if (!hasProjects) {
    return (
      <p className="empty-text" title="먼저 프로젝트를 만들어야 이 화면에서 할일을 추가할 수 있습니다.">
        먼저 프로젝트를 만들어야 이 화면에서 할일을 추가할 수 있습니다.
      </p>
    );
  }

  return (
    // P12.5: AddProjectForm(P12.4)과 같은 .project-add-form--stacked 모디파이어를 그대로
    // 재사용한다 — 이 화면도 필드가 4개(제목/프로젝트/마감일/버튼)로 늘어 같은 이유(420px 폭
    // 오버플로 방지)로 두 줄 구조가 필요했다. .project-add-form 기본값(row)은 건드리지 않아
    // 다른 화면 영향 없음(P12.4 critical-reviewer 지적 반영 — 공유 클래스는 절대 통째로
    // 바꾸지 않고 모디파이어로만 범위를 좁힌다).
    <form className="project-add-form project-add-form--stacked" onSubmit={handleSubmit}>
      <input
        type="text"
        className="todo-add-input"
        placeholder="새 할일 입력"
        value={title}
        readOnly={disabled}
        onChange={(e) => {
          setTitle(e.target.value);
          if (saveError) setSaveError(null);
        }}
      />
      <div className="project-edit-row">
        <select
          aria-label="소속 프로젝트"
          value={projectId}
          disabled={disabled}
          onChange={(e) => {
            setProjectId(e.target.value);
            if (saveError) setSaveError(null);
          }}
        >
          <option value="" disabled>
            프로젝트 선택
          </option>
          {usableProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <DueDatePicker value={dueDate} onChange={setDueDate} disabled={disabled} />
        <button type="submit" className="project-edit-save" disabled={disabled}>
          추가
        </button>
      </div>
      {saveError && <p className="data-issue-notice">{saveError}</p>}
    </form>
  );
}
