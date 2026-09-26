// P3.5: TodoRow.jsx의 행이 수정 모드로 전환될 때 렌더되는 폼 + 삭제 버튼.
// ProjectEditForm.jsx와 같은 구조(보기/수정 두 모드, 삭제는 2단계 확인)를 그대로 따른다.
import { useState } from 'react';
import { getUsableProjects } from '../lib/projectLookup.js';
import FieldToggleGroup from './FieldToggleGroup.jsx';
import DueDatePicker from './DueDatePicker.jsx';
// critical-reviewer 지적(P12.19 재검증, Medium): 이 파일이 정규식을 따로 정의하면 dateRange.js
// 것과 한쪽만 고쳐져 갈라질 수 있다(예: ProjectEditForm.jsx는 이미 dateRange.js에서 가져다 씀)
// — 같은 출처를 쓰게 통일한다. critical-reviewer 지적(재검증 2라운드, Medium): 형태 검사
// (DATE_STRING_RE)만으로는 "2026-13-45"처럼 형태는 맞지만 실제로 없는 날짜를 걸러내지 못해서,
// DueDatePicker는 빈칸("날짜 선택")으로 보이는데 이 state엔 원래 깨진 값이 그대로 남아 저장 시
// 그대로 다시 쓰이는 결함이 있었다 — DueDatePicker와 동일한 왕복 검증 함수(isValidDateString)로
// 교체해 화면 표시와 저장 정리가 같은 기준을 쓰게 한다.
import { isValidDateString } from '../lib/dateRange.js';

const PRIORITIES = ['상', '중', '하'];
const PRIORITY_OPTIONS = [{ value: '', label: '없음' }, ...PRIORITIES.map((p) => ({ value: p, label: p }))];

function tagsToText(tags) {
  return Array.isArray(tags) ? tags.join(', ') : '';
}

// 중복 태그("회의, 회의")를 저장하지 않도록 정리한다(critical-reviewer 지적).
function textToTags(text) {
  const seen = new Set();
  const result = [];
  for (const raw of text.split(',')) {
    const t = raw.trim();
    if (t !== '' && !seen.has(t)) {
      seen.add(t);
      result.push(t);
    }
  }
  return result;
}

// P12.19 이전에는 <input type="date">가 형식이 깨진 값(예: '2026-9-5')을 조용히 빈칸으로
// 보여주면서 내부 state는 그대로 들고 있어, 사용자가 "빈칸이니 마감일 없음"으로 착각한 채
// 저장하면 깨진 값이 그대로 다시 쓰이는 결함이 있었다(critical-reviewer 지적) — 형식이 안
// 맞으면 처음부터 빈 문자열로 state를 시작해서, 화면 표시(빈칸)와 실제 저장 결과(handleSubmit의
// `dueDate.trim() || null` → null)를 일치시킨다. 즉 손상된 원본 값은 사용자가 아무것도 건드리지
// 않고 저장만 해도 null로 "조용히" 정리된다 — critical-reviewer 지적(재검증): 이전 주석이
// "조용히 지우지 않는다"고 반대로 적혀 있었음, 정정. P12.19 이후에도 이 정규화는 여전히
// 필요하다 — DueDatePicker 자체의 방어는 마운트 크래시만 막을 뿐, state 자체를 정리하진
// 않는다(ProjectEditForm.jsx도 같은 방식으로 맞춰 두 폼이 손상 데이터를 동일하게 처리한다).
// 형태만 보는 DATE_STRING_RE 대신 isValidDateString(왕복 검증 포함)을 써서 "2026-13-45"처럼
// 형태는 맞지만 실제로 없는 날짜도 여기서 걸러낸다(critical-reviewer 지적 재검증 2라운드).
function toDateInputValue(dueDate) {
  return isValidDateString(dueDate) ? dueDate : '';
}

// B3.2가 project_id를 필수로 규정하므로 소속 프로젝트 select도 P3.3과 동일하게 명시적 선택을
// 강제한다 — 단, 여기서는 현재 값이 선택 가능한 목록에 있으면 그 값을 기본으로 보여준다(수정은
// "이미 정해진 값을 바꾸는" 행위라 추가 폼과 달리 기본값이 있는 편이 자연스럽다). 목록에 없으면
// (예: 소속 프로젝트가 삭제된 고아 todo, P2.8 참고) 빈 값으로 강제해 재배정을 요구한다 — 이
// 화면이 그 고아 레코드의 실질적인 복구 경로가 된다.
// usableProjects가 아예 0개면(예: 유일한 프로젝트를 삭제해 모든 todo가 고아가 된 경우) 강제
// 선택이 원천적으로 불가능해지므로, select 자체를 숨기고 project_id는 원래 값 그대로 저장한다
// — 그래야 프로젝트가 하나도 없는 상태에서도 제목/마감일 등 프로젝트와 무관한 오타는 여전히
// 고칠 수 있다(critical-reviewer [High] 지적: 이 분기가 없으면 그 상태에서 수정 폼 자체가
// 영구히 저장 불가능해짐 — 정작 이 화면이 고아 복구 경로로 가장 필요한 상황에서 막힘).
export function TodoEditForm({ todo, projects, onSave, onCancel, disabled = false }) {
  const usableProjects = getUsableProjects(projects);
  const hasUsableProjects = usableProjects.length > 0;
  const [title, setTitle] = useState(todo.title ?? '');
  const [dueDate, setDueDate] = useState(toDateInputValue(todo.due_date));
  const [priority, setPriority] = useState(PRIORITIES.includes(todo.priority) ? todo.priority : '');
  const [tagsText, setTagsText] = useState(tagsToText(todo.tags));
  const [projectId, setProjectId] = useState(
    usableProjects.some((p) => p.id === todo.project_id) ? todo.project_id : ''
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const busy = saving || disabled;

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setSaveError('할일 제목을 입력하세요.');
      return;
    }
    if (hasUsableProjects && !projectId) {
      setSaveError('프로젝트를 선택하세요.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await onSave({
        title: trimmed,
        due_date: dueDate.trim() || null,
        priority: priority || null,
        tags: textToTags(tagsText),
        project_id: hasUsableProjects ? projectId : todo.project_id,
      });
    } catch (err) {
      console.error('할일 저장 실패:', err);
      setSaveError('할일을 저장하지 못했습니다.');
      setSaving(false);
    }
  }

  return (
    <li className="todo-row todo-row-editing">
      <form className="project-edit-form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="todo-add-input"
          value={title}
          disabled={busy}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="할일 제목"
        />
        {/* critical-reviewer 지적(Playwright 스크린샷으로 실측): 소속 프로젝트 select + 우선순위
            토글(옵션 4개) + 날짜를 한 줄에 다 넣으니 420px 폭에서 우선순위 버튼 절반이 잘리고
            날짜도 잘렸다 — 우선순위 토글만 별도 줄로 빼서 네 버튼 모두 온전히 보이게 한다. */}
        <div className="project-edit-row">
          {hasUsableProjects ? (
            <select
              aria-label="소속 프로젝트"
              value={projectId}
              disabled={busy}
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
          ) : (
            <span className="todo-no-projects-notice">선택할 프로젝트가 없어 소속은 그대로 유지됩니다.</span>
          )}
          <DueDatePicker value={dueDate} onChange={setDueDate} disabled={busy} />
        </div>
        <FieldToggleGroup
          options={PRIORITY_OPTIONS}
          value={priority}
          onChange={setPriority}
          disabled={busy}
          ariaLabel="우선순위"
        />
        <input
          type="text"
          className="todo-add-input"
          value={tagsText}
          disabled={busy}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder="태그(쉼표로 구분)"
        />
        {saveError && <p className="data-issue-notice">{saveError}</p>}
        <div className="project-edit-actions">
          <button type="submit" className="project-edit-save" disabled={busy}>
            저장
          </button>
          <button type="button" className="project-edit-cancel" disabled={busy} onClick={onCancel}>
            취소
          </button>
        </div>
      </form>
    </li>
  );
}

// P2.5의 DeleteProjectButton과 동일한 2단계 확인 패턴 — 네이티브 confirm() 대신 같은 화면 안에서
// 확인한다("별도 팝업 없음" 기조 + 자동화 검증 용이성).
export function DeleteTodoButton({ onDelete, disabled = false }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const busy = deleting || disabled;

  if (!confirming) {
    return (
      <button type="button" className="todo-delete-toggle" disabled={disabled} onClick={() => setConfirming(true)}>
        삭제
      </button>
    );
  }

  return (
    <span className="todo-delete-confirm">
      정말 삭제할까요?
      <button
        type="button"
        className="todo-delete-toggle"
        disabled={busy}
        onClick={async () => {
          setDeleting(true);
          setDeleteError(null);
          try {
            await onDelete();
          } catch (err) {
            console.error('할일 삭제 실패:', err);
            setDeleteError('삭제하지 못했습니다.');
            setDeleting(false);
          }
        }}
      >
        확인
      </button>
      <button type="button" className="delete-cancel-button" disabled={busy} onClick={() => setConfirming(false)}>
        취소
      </button>
      {deleteError && <span className="data-issue-notice">{deleteError}</span>}
    </span>
  );
}
