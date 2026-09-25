// P3.5: TodoRow.jsx의 행이 수정 모드로 전환될 때 렌더되는 폼 + 삭제 버튼.
// ProjectEditForm.jsx와 같은 구조(보기/수정 두 모드, 삭제는 2단계 확인)를 그대로 따른다.
import { useState } from 'react';
import { getUsableProjects } from '../lib/projectLookup.js';

const PRIORITIES = ['상', '중', '하'];
const DATE_STRING_RE = /^\d{4}-\d{2}-\d{2}$/;

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

// <input type="date">는 형식이 깨진 값(예: '2026-9-5')을 조용히 빈칸으로 보여주면서 내부 state는
// 그대로 들고 있어, 사용자가 "빈칸이니 마감일 없음"으로 착각한 채 저장하면 깨진 값이 그대로
// 다시 쓰이는 결함이 있다(critical-reviewer 지적) — 형식이 안 맞으면 처음부터 빈 문자열로
// 시작해 그 값을 조용히 지우지 않되 "빈칸=없음"이라는 화면 표시와 실제 저장 결과를 일치시킨다.
function toDateInputValue(dueDate) {
  return typeof dueDate === 'string' && DATE_STRING_RE.test(dueDate) ? dueDate : '';
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
          <select value={priority} disabled={busy} onChange={(e) => setPriority(e.target.value)}>
            <option value="">우선순위 없음</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dueDate}
            disabled={busy}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
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
          <button type="button" className="back-button" disabled={busy} onClick={onCancel}>
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
      <button type="button" className="back-button" disabled={busy} onClick={() => setConfirming(false)}>
        취소
      </button>
      {deleteError && <span className="data-issue-notice">{deleteError}</span>}
    </span>
  );
}
