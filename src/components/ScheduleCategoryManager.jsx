// P12.16(P12.10 사람 결정): 일정 카테고리(이름+고정 팔레트 색) 관리 UI. 별도 사이드바 메뉴를
// 새로 만들지 않고 일정 화면(Schedule.jsx) 안의 진입점으로 뒀다 — 이 위젯은 단일 사용자용이고
// 카테고리 관리는 자주 쓰는 기능이 아니라, 고정 5개인 사이드바 메뉴를 늘리기보다는 관련
// 화면(일정) 안에 접어둔 패널로 두는 편이 이 앱의 "화면당 하나의 목적" 기조에 맞는다.
import { useState } from 'react';
import { CATEGORY_PALETTE, normalizeCategoryColor } from '../lib/categoryPalette.js';
import { getUsableCategories } from '../lib/scheduleCategoryMutations.js';

function SwatchPicker({ value, onChange, disabled }) {
  return (
    <div className="category-swatch-picker" role="group" aria-label="카테고리 색상">
      {CATEGORY_PALETTE.map((c) => (
        <button
          key={c.key}
          type="button"
          className={value === c.key ? `category-swatch-button is-${c.key} selected` : `category-swatch-button is-${c.key}`}
          disabled={disabled}
          aria-pressed={value === c.key}
          aria-label={c.label}
          onClick={() => onChange(c.key)}
        />
      ))}
    </div>
  );
}

function AddCategoryForm({ onAdd, disabled }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_PALETTE[0].key);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const busy = saving || disabled;

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError('카테고리 이름을 입력하세요.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onAdd({ name: trimmed, color });
      setName('');
      setColor(CATEGORY_PALETTE[0].key);
    } catch (err) {
      console.error('카테고리 추가 실패:', err);
      setError('카테고리를 추가하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="project-edit-form" onSubmit={handleSubmit}>
      <input
        type="text"
        className="todo-add-input"
        placeholder="새 카테고리 이름"
        value={name}
        readOnly={busy}
        onChange={(e) => {
          setName(e.target.value);
          if (error) setError(null);
        }}
      />
      <SwatchPicker value={color} onChange={setColor} disabled={busy} />
      <button type="submit" className="project-edit-save" disabled={busy}>
        추가
      </button>
      {error && <p className="data-issue-notice">{error}</p>}
    </form>
  );
}

function CategoryRow({ category, onEdit, onDelete, disabled }) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [name, setName] = useState(category.name);
  // critical-reviewer 지적(P12.16 재검증, Medium): dataStore.js는 color가 아예 없을 때만
  // 기본값을 채우고(P6.4), 이미 손상된 값(예: 팔레트 밖 문자열, 수기 편집된 data.json)은
  // 그대로 통과시킨다 — normalizeCategoryColor를 거치지 않으면 스와치가 클래스 없이
  // 투명하게 보이고, 수정 모드에서는 아무 팔레트 버튼도 선택 안 된 채로 시작해 저장 시
  // 조용히 gray로 바뀌는 표시-저장 불일치가 생긴다(FieldToggleGroup의 enum 폴백과 같은 이유).
  const safeColor = normalizeCategoryColor(category.color);
  const [color, setColor] = useState(safeColor);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const busy = saving || disabled;

  async function handleSave(e) {
    e.preventDefault();
    if (busy) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError('카테고리 이름을 입력하세요.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onEdit(category.id, { name: trimmed, color });
      setEditing(false);
    } catch (err) {
      console.error('카테고리 수정 실패:', err);
      setError('카테고리를 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <li className="schedule-category-row">
        <form className="project-edit-form" onSubmit={handleSave}>
          <input
            type="text"
            className="todo-add-input"
            placeholder="카테고리 이름"
            value={name}
            disabled={busy}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
          />
          <SwatchPicker value={color} onChange={setColor} disabled={busy} />
          <div className="project-edit-actions">
            <button type="submit" className="project-edit-save" disabled={busy}>
              저장
            </button>
            <button
              type="button"
              className="project-edit-cancel"
              disabled={busy}
              onClick={() => {
                setName(category.name);
                setColor(safeColor);
                setEditing(false);
                setError(null);
              }}
            >
              취소
            </button>
          </div>
          {error && <p className="data-issue-notice">{error}</p>}
        </form>
      </li>
    );
  }

  return (
    <li className="schedule-category-row">
      <span className="schedule-category-info">
        <span className={`schedule-category-swatch is-${safeColor}`} />
        <span className="schedule-category-name">{category.name}</span>
      </span>
      {confirmingDelete ? (
        <span className="todo-delete-confirm">
          정말 삭제할까요?
          <button
            type="button"
            className="todo-delete-toggle"
            disabled={busy}
            onClick={async () => {
              setSaving(true);
              try {
                await onDelete(category.id);
              } catch (err) {
                console.error('카테고리 삭제 실패:', err);
                setError('삭제하지 못했습니다.');
                setSaving(false);
              }
            }}
          >
            확인
          </button>
          <button
            type="button"
            className="delete-cancel-button"
            disabled={busy}
            onClick={() => setConfirmingDelete(false)}
          >
            취소
          </button>
        </span>
      ) : (
        <span className="schedule-category-actions">
          <button type="button" className="todo-edit-toggle" disabled={disabled} onClick={() => setEditing(true)}>
            수정
          </button>
          <button
            type="button"
            className="todo-delete-toggle"
            disabled={disabled}
            onClick={() => setConfirmingDelete(true)}
          >
            삭제
          </button>
        </span>
      )}
      {error && <p className="data-issue-notice">{error}</p>}
    </li>
  );
}

export default function ScheduleCategoryManager({ categories, onAdd, onEdit, onDelete, disabled = false }) {
  // critical-reviewer 지적(P12.16 재검증, Medium): id 없는 레코드(수기 편집된 data.json 등)가
  // 그대로 들어오면 key={undefined}가 되고, 그 행의 삭제 버튼이 removeCategory(undefined)를
  // 불러 id 없는 레코드를 전부 지워버릴 수 있었다 — 다른 화면들(getUsableProjects 등)과 같은
  // 방어를 이 컴포넌트 진입점에서 한다. critical-reviewer 지적(재검증 2라운드, Medium): 이
  // 필터를 여기서만 하면 Schedule.jsx의 카드 배지(필터 전 길이)와 실제 렌더되는 행 수가
  // 손상 데이터에서 서로 달라진다 — getUsableCategories로 옮겨 두 호출부가 같은 필터를 쓰게
  // 한다.
  const usableCategories = getUsableCategories(categories);
  return (
    <>
      {usableCategories.length === 0 ? (
        <p className="empty-text">등록된 카테고리가 없습니다.</p>
      ) : (
        <ul className="card-list">
          {usableCategories.map((c) => (
            <CategoryRow key={c.id} category={c} onEdit={onEdit} onDelete={onDelete} disabled={disabled} />
          ))}
        </ul>
      )}
      <AddCategoryForm onAdd={onAdd} disabled={disabled} />
    </>
  );
}
