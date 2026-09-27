// Schedule.jsx(P5.2)에서 분리 — 선택한 날짜의 일정 제목 목록 + 수정/삭제(P5.4~P5.6). 월간/
// 주간 뷰가 공유한다.
import { useState } from 'react';
import { getSchedulesForDate, isScheduleRecurring, getHolidayInfo, getBacklogDueItemsForDate } from '../lib/scheduleGrid.js';
import { resolveCategoryColor, resolveCategoryName } from '../lib/categoryPalette.js';
import { ScheduleEditForm, DeleteScheduleButton } from './ScheduleEditForm.jsx';

// TodoRow.jsx와 같은 패턴: 각 행이 자기만의 editing 상태를 들고, 수정 모드일 땐 ScheduleEditForm으로
// 바뀐다. B3.4상 반복 일정은 회차별 레코드가 없어 이 하나의 폼으로 수정/삭제하면 그대로 "이후
// 모든 회차에 일괄 반영"(P5.5)/"모든 회차가 함께 사라짐"이 성립한다. disabled는 화면
// (Schedule.jsx) 전체의 저장 진행 여부 — 다른 행/추가 폼과의 저장 경합을 막는다(Todos.jsx와
// 동일 패턴, critical-reviewer 지적).
// P12.17(routine-planner의 RoutineItem.tsx colorBar 참고): 행 왼쪽에 카테고리 색 막대를 둬서
// 달력 점과 같은 색 언어를 목록에서도 그대로 쓴다 — 미분류면 무색(is-none과 동일하게 빈 테두리만).
// critical-reviewer 지적(Medium): 막대가 색만으로 카테고리를 구분시키면 색맹 사용자나 비슷한
// 톤(회색 카테고리 vs 미분류)에서 식별이 어렵다 — title(hover 툴팁)에 카테고리 이름 텍스트를
// 함께 제공한다.
function ScheduleItemRow({ schedule, categories, onEdit, onDelete, disabled }) {
  const [editing, setEditing] = useState(false);
  const color = resolveCategoryColor(schedule.category_id, categories);
  const categoryName = resolveCategoryName(schedule.category_id, categories) ?? '미분류';
  const barClassName = color ? `schedule-item-colorbar is-${color}` : 'schedule-item-colorbar is-none';

  if (editing) {
    return (
      <li className="schedule-item-row schedule-item-row-editing">
        <span className={barClassName} title={categoryName} />
        <div className="schedule-item-content">
          <ScheduleEditForm
            schedule={schedule}
            categories={categories}
            disabled={disabled}
            onCancel={() => setEditing(false)}
            onSave={async (updates) => {
              await onEdit(schedule.id, updates);
              setEditing(false);
            }}
          />
        </div>
      </li>
    );
  }

  return (
    <li className="schedule-item-row">
      <span className={barClassName} title={categoryName} />
      <div className="schedule-item-content">
        <div className="schedule-item-main">
          <span className="schedule-item-title">{schedule.title}</span>
          {isScheduleRecurring(schedule) && <span className="schedule-recurring-badge">반복</span>}
        </div>
        <div className="schedule-item-actions">
          <button type="button" className="todo-edit-toggle" disabled={disabled} onClick={() => setEditing(true)}>
            수정
          </button>
          <DeleteScheduleButton
            onDelete={() => onDelete(schedule.id)}
            isRecurring={isScheduleRecurring(schedule)}
            disabled={disabled}
          />
        </div>
      </div>
    </li>
  );
}

// P28: 백로그 유래 목표일 항목 한 줄 — 읽기 전용(수정/삭제 버튼 없음, B3.5 원칙). 상태 변경은
// 오직 원본 backlog(.json)을 다시 읽어야만 반영된다.
function BacklogDueItemRow({ item }) {
  return (
    <li className="schedule-item-row">
      <span className="schedule-item-colorbar is-none" title="백로그 목표일(읽기 전용)" />
      <div className="schedule-item-content">
        <div className="schedule-item-main">
          <span className="schedule-item-title">{item.title}</span>
          <span className="schedule-backlog-badge">{item.sourceLabel}</span>
        </div>
        <span className="backlog-status-task-owner">{item.status}</span>
      </div>
    </li>
  );
}

// id 없는 레코드는 React key로 못 쓰므로 제외한다(Dashboard.jsx/projectTodos.js와 동일 방어
// — electron/dataStore.js의 normalizeData(P6.4)는 누락된 필드를 기본값으로 채우지만 id를
// 지어내지는 않고, 타입이 잘못된 값(예: title이 객체)도 그대로 둔다).
export default function ScheduleDateDetail({
  date,
  schedules,
  categories = [],
  backlogItems = [],
  onEdit,
  onDelete,
  disabled = false,
}) {
  const all = getSchedulesForDate(schedules, date);
  const items = all.filter((s) => typeof s.id === 'string');
  const droppedCount = all.length - items.length;
  const backlogDue = getBacklogDueItemsForDate(backlogItems, date);
  // P12.8: 셀 폭 제약(약 38px) 때문에 공휴일 이름을 셀에 직접 못 넣는다 — title 속성(hover
  // tooltip)과 함께, 날짜를 선택했을 때 확실히 보이는 이 카드에도 표시한다(done_when: "선택하면
  // 이름을 확인할 수 있음"). critical-reviewer 지적(High): korean-holidays는 대체공휴일의
  // nameKo에 이미 "대체공휴일 (원래 공휴일명)" 형태로 접두어를 포함해서 돌려준다 — 여기서
  // " (대체공휴일)"을 또 붙이면 "대체공휴일 (3·1절) (대체공휴일)"처럼 중복 표시된다. 그대로
  // holiday.name만 쓴다.
  const holiday = getHolidayInfo(date);
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">{date}</h2>
        <span className="card-count-badge">{items.length + backlogDue.length}</span>
      </div>
      {holiday && <p className="schedule-holiday-name">{holiday.name}</p>}
      {droppedCount > 0 && (
        <p className="data-issue-notice">
          id 없는 일정 {droppedCount}개는 목록에 표시되지 않습니다 (data.json 확인 필요)
        </p>
      )}
      {items.length === 0 && backlogDue.length === 0 ? (
        <p className="empty-text">이 날짜에 등록된 일정이 없습니다.</p>
      ) : (
        <ul className="card-list">
          {items.map((s) => (
            <ScheduleItemRow
              key={s.id}
              schedule={s}
              categories={categories}
              onEdit={onEdit}
              onDelete={onDelete}
              disabled={disabled}
            />
          ))}
          {backlogDue.map((b, i) => (
            // critical-reviewer 지적(Medium): 서로 다른 소스가 같은 id를 쓰거나(B3.5 — 형식을
            // 통제 못 하는 외부 데이터) 한 소스 안에 id가 중복될 수 있어 b.id만으로는 React
            // key가 충돌할 수 있었다 — sourceId를 섞고, 그래도 남는 한 소스 내 중복은 인덱스로 구분.
            <BacklogDueItemRow key={`${b.sourceId}:${b.id}:${i}`} item={b} />
          ))}
        </ul>
      )}
    </div>
  );
}
