// ScheduleDateDetail.jsx(P5.4/P5.5/P5.6)의 일정 행이 수정 모드로 전환될 때 렌더되는 폼 +
// 삭제 버튼. TodoEditForm.jsx/ProjectEditForm.jsx와 같은 구조(보기/수정 두 모드, 삭제는
// 2단계 확인)를 그대로 따른다. B3.4: 반복 일정은 회차별 레코드가 없으므로 이 폼으로 규칙
// 하나를 수정/삭제하면 그 자체로 "이후 모든 회차에 일괄 반영"(수정)/"모든 회차가 함께
// 사라짐"(삭제)이 성립한다 — 별도 회차 처리가 필요 없다. critical-reviewer 지적(P5.4 리뷰):
// 여기 보이는 date는 클릭한 회차의 날짜가 아니라 규칙의 "기준일"이라 라벨 없이는 오해하기
// 쉽고(기준일을 바꾸면 과거/미래 회차가 통째로 나타나거나 사라짐), 수정/삭제가 모든 회차에
// 적용된다는 사실도 화면에 없었다 — 둘 다 안내 문구를 추가한다.
import { useState } from 'react';
import { isScheduleRecurring } from '../lib/scheduleGrid.js';

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

function sortByWeekday(days) {
  return [...days].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b));
}

export function ScheduleEditForm({ schedule, onSave, onCancel, disabled = false }) {
  const [title, setTitle] = useState(schedule.title ?? '');
  const [date, setDate] = useState(schedule.date ?? '');
  const [isRecurring, setIsRecurring] = useState(isScheduleRecurring(schedule));
  const [recurrenceDays, setRecurrenceDays] = useState(
    Array.isArray(schedule.recurrence_days) ? schedule.recurrence_days : []
  );
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
      setSaveError('날짜를 선택하세요.');
      return;
    }
    if (isRecurring && recurrenceDays.length === 0) {
      setSaveError('반복 요일을 하나 이상 선택하세요.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await onSave({
        title: trimmed,
        date,
        is_recurring: isRecurring,
        recurrence_days: isRecurring ? sortByWeekday(recurrenceDays) : null,
      });
    } catch (err) {
      console.error('일정 저장 실패:', err);
      setSaveError('일정을 저장하지 못했습니다.');
      setSaving(false);
    }
  }

  return (
    <form className="project-edit-form" onSubmit={handleSubmit}>
      {isScheduleRecurring(schedule) && (
        <p className="schedule-base-date-hint">
          이 일정은 반복 규칙 하나로 관리됩니다 — 여기서 수정/삭제하면 이 요일의 모든 회차(과거
          포함)에 함께 적용됩니다.
        </p>
      )}
      <input
        type="text"
        className="todo-add-input"
        value={title}
        disabled={busy}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="일정 제목"
      />
      <div className="project-edit-row">
        <input type="date" value={date} disabled={busy} onChange={(e) => setDate(e.target.value)} />
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
            위 날짜는 반복이 시작되는 기준일입니다 — 이 날짜를 바꾸면 그 이전/이후 회차의 노출
            여부가 함께 바뀝니다.
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
  );
}

// DeleteProjectButton/DeleteTodoButton과 같은 2단계 확인 패턴.
export function DeleteScheduleButton({ onDelete, isRecurring = false, disabled = false }) {
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
      {isRecurring ? '이 요일의 모든 회차가 함께 삭제됩니다. 정말 삭제할까요?' : '정말 삭제할까요?'}
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
            console.error('일정 삭제 실패:', err);
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
