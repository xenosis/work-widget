// P5.4/P5.6: 일정 추가 폼. 일회성/반복 두 유형을 하나의 폼에서 다룬다 — B3.4가 두 유형을
// 같은 레코드 구조(date/is_recurring/recurrence_days)로 규정하므로 폼을 둘로 나누면 필드
// 대부분(제목/날짜)을 중복 관리해야 한다. "별도 팝업 없이 입력창에서 바로 추가"(B2.1 기조)를
// 따라 인라인 폼으로 둔다.
// critical-reviewer 지적(P5.4 리뷰): (1) .project-add-form(가로 flex, wrap 없음)을 그대로
// 쓰면 제목/날짜/반복 체크/요일 7칸/버튼이 420px 폭 한 줄에 몰려 찌그러진다 — .project-edit-form
// (세로 flex) 기반으로 바꾼다. (2) key로 강제 리마운트하면 날짜를 클릭해 selectedDate가 바뀔
// 때마다 입력 중이던 제목/반복 설정이 통째로 사라진다 — key를 없애고, 사용자가 날짜를 직접
// 건드리지 않은 동안만 defaultDate 변화를 따라가는 "더럽혀지지 않았을 때만 동기화" 방식으로 바꾼다.
import { useState } from 'react';
import DueDatePicker from './DueDatePicker.jsx';
import { getUsableCategories, resolveSubmittableCategoryId } from '../lib/scheduleCategoryMutations.js';

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

function sortByWeekday(days) {
  return [...days].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b));
}

export default function ScheduleAddForm({ onAdd, defaultDate = '', categories = [], disabled = false }) {
  const [title, setTitle] = useState('');
  // 날짜를 useState로 직접 들고 defaultDate와 동기화하는 대신(useEffect+setState는
  // react-hooks 규칙이 막음, cascading render 위험), 사용자가 직접 고친 값(manualDate)이
  // 있을 때만 그 값을, 없으면 defaultDate를 그대로 파생시킨다 — selectedDate가 바뀌어도
  // 사용자가 이미 고른 날짜를 덮어쓰지 않는다.
  const [manualDate, setManualDate] = useState(null);
  const date = manualDate ?? defaultDate;
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceDays, setRecurrenceDays] = useState([]);
  // P12.17: 카테고리는 선택 입력(미분류 허용) — 빈 문자열이 "미분류"를 뜻한다(제출 시 null로
  // 변환). getUsableCategories로 id 없는 레코드(수기 편집된 data.json 등)는 옵션에서 제외한다.
  const [categoryId, setCategoryId] = useState('');
  const usableCategories = getUsableCategories(categories);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const busy = saving || disabled;

  function toggleDay(day) {
    setRecurrenceDays((days) => (days.includes(day) ? days.filter((d) => d !== day) : [...days, day]));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setSaveError('일정 제목을 입력하세요.');
      return;
    }
    if (!date) {
      setSaveError(isRecurring ? '반복이 시작되는 기준일을 선택하세요.' : '날짜를 선택하세요.');
      return;
    }
    if (isRecurring && recurrenceDays.length === 0) {
      setSaveError('반복 요일을 하나 이상 선택하세요.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await onAdd({
        title: trimmed,
        date,
        isRecurring,
        recurrenceDays: sortByWeekday(recurrenceDays),
        categoryId: resolveSubmittableCategoryId(categoryId, categories),
      });
      setTitle('');
      setManualDate(null);
      setIsRecurring(false);
      setRecurrenceDays([]);
      setCategoryId('');
    } catch (err) {
      console.error('일정 저장 실패:', err);
      setSaveError('일정을 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="project-edit-form schedule-add-form" onSubmit={handleSubmit}>
      <input
        type="text"
        className="todo-add-input"
        placeholder="새 일정 제목"
        value={title}
        readOnly={busy}
        onChange={(e) => {
          setTitle(e.target.value);
          if (saveError) setSaveError(null);
        }}
      />
      <div className="project-edit-row">
        <DueDatePicker
          value={date}
          onChange={setManualDate}
          disabled={busy}
          ariaLabel="날짜(필수)"
          popoverAlign="left"
          clearable={false}
        />
        <label className="schedule-recurring-toggle">
          <input
            type="checkbox"
            checked={isRecurring}
            disabled={busy}
            onChange={(e) => setIsRecurring(e.target.checked)}
          />
          매주 반복
        </label>
      </div>
      {isRecurring && (
        <>
          <p className="schedule-base-date-hint">
            위 날짜는 반복이 시작되는 기준일입니다 — 이 날짜 이전 요일에는 노출되지 않습니다.
          </p>
          <div className="schedule-weekday-picker">
            {WEEKDAYS.map((day) => (
              <button
                key={day}
                type="button"
                className={recurrenceDays.includes(day) ? 'schedule-weekday-chip active' : 'schedule-weekday-chip'}
                disabled={busy}
                onClick={() => toggleDay(day)}
              >
                {day}
              </button>
            ))}
          </div>
        </>
      )}
      {/* P12.17: 카테고리는 사용자가 자유롭게 늘릴 수 있는 가변 옵션 목록이라(P12.13/P12.21
          사람 결정: 가변 목록은 네이티브 select 유지) 토글 버튼 그룹 대신 select를 쓴다. */}
      <div className="project-edit-row">
        <select
          aria-label="카테고리"
          value={categoryId}
          disabled={busy}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">미분류</option>
          {usableCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="project-edit-save" disabled={busy}>
        추가
      </button>
      {saveError && <p className="data-issue-notice">{saveError}</p>}
    </form>
  );
}
