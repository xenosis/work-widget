// P23(사용자 요청, 2026-09-27): 월간 보기에서는 그 달 전체 일정을, 주간 보기에서는 그 주
// 전체 일정을 달력 아래에서 날짜순으로 한 번에 확인하고 싶다는 요청 — 날짜를 하나씩
// 클릭해가며 ScheduleDateDetail로 보는 것과 별개로, 스크롤만으로 기간 전체를 훑을 수 있게
// 한다. 그래서 이 목록은 읽기 전용이다(수정/삭제는 여전히 날짜를 선택해 ScheduleDateDetail에서
// 한다 — 같은 조작을 두 곳에 중복 구현하면 한쪽만 고쳤을 때 갈라질 위험이 있고, 이 목록의
// 목적도 "훑어보기"이지 "편집"이 아니다). id 없는 레코드는 getSchedulesInRange(scheduleGrid.js)
// 가 이미 걸러서 돌려준다.
import { getScheduleRangeDates, getSchedulesInRange, isScheduleRecurring } from '../lib/scheduleGrid.js';
import { resolveCategoryColor, resolveCategoryName } from '../lib/categoryPalette.js';

// critical-reviewer 지적(Medium): title이 문자열이 아니거나 빈 값이면(B3.4가 막지 않는
// 손상 데이터) 그대로 렌더링하다 React가 죽을 수 있다 — scheduleGrid.js의
// getScheduleCellSummary와 같은 방어(빈 값은 "(제목 없음)")를 여기도 둔다.
function resolveTitle(schedule) {
  return typeof schedule.title === 'string' && schedule.title.trim() ? schedule.title : '(제목 없음)';
}

function ScheduleRangeGroup({ date, items, categories }) {
  return (
    <li className="schedule-range-group">
      <h3 className="schedule-range-date">{date}</h3>
      <ul className="card-list">
        {items.map((s) => {
          const color = resolveCategoryColor(s.category_id, categories);
          const categoryName = resolveCategoryName(s.category_id, categories) ?? '미분류';
          const barClassName = color ? `schedule-item-colorbar is-${color}` : 'schedule-item-colorbar is-none';
          return (
            <li key={s.id} className="schedule-item-row">
              <span className={barClassName} title={categoryName} />
              <div className="schedule-item-content">
                <div className="schedule-item-main">
                  <span className="schedule-item-title">{resolveTitle(s)}</span>
                  {isScheduleRecurring(s) && <span className="schedule-recurring-badge">반복</span>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </li>
  );
}

export default function ScheduleRangeList({ view, monthCursor, weekAnchor, schedules, categories }) {
  const dateStrings = getScheduleRangeDates(view, monthCursor, weekAnchor);
  // "이번 주"라고 고정하면 이전/다음 주로 이동했을 때도 문구가 그대로라 오해를 준다 — 실제
  // 보여주는 주의 날짜 범위를 그대로 제목에 쓴다(월간 쪽은 monthCursor의 실제 연/월을 쓰는
  // 것과 같은 이유).
  const title =
    view === 'week'
      ? `${dateStrings[0]} ~ ${dateStrings[dateStrings.length - 1]} 전체 일정`
      : `${monthCursor.year}년 ${monthCursor.month + 1}월 전체 일정`;
  const { groups, droppedCount } = getSchedulesInRange(schedules, dateStrings);
  const total = groups.reduce((sum, g) => sum + g.items.length, 0);
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">{title}</h2>
        <span className="card-count-badge">{total}</span>
      </div>
      {/* ScheduleDateDetail.jsx와 같은 문구/클래스 — 같은 문제를 한쪽은 알리고 한쪽은
          조용히 숨기면 데이터 손실 신호가 화면마다 갈린다(critical-reviewer 지적). */}
      {droppedCount > 0 && (
        <p className="data-issue-notice">
          id 없는 일정 {droppedCount}개는 목록에 표시되지 않습니다 (data.json 확인 필요)
        </p>
      )}
      {groups.length === 0 ? (
        <p className="empty-text">등록된 일정이 없습니다.</p>
      ) : (
        <ul className="schedule-range-groups">
          {groups.map((g) => (
            <ScheduleRangeGroup key={g.date} date={g.date} items={g.items} categories={categories} />
          ))}
        </ul>
      )}
    </div>
  );
}
