// Schedule.jsx(P5.2)에서 분리 — 월간 그리드 전용. eslint max-lines 여유 확보 목적도 있음
// (ProjectDetail/ProjectEditForm 분리와 같은 이유).
import { getMonthGrid, getSchedulesForDate, getHolidayInfo, getDayCellClassNames } from '../lib/scheduleGrid.js';

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
// P12.6: 헤더는 요일 라벨이 고정 배열이라 날짜 계산 없이도 순서로 토/일을 알 수 있다 — 셀은
// 인접 달까지 섞여 있어 라벨 순서만으로는 판정할 수 없으므로 getWeekdayKind(cell.date)를 쓴다.
const WEEKDAY_HEADER_KINDS = ['weekday', 'weekday', 'weekday', 'weekday', 'weekday', 'saturday', 'sunday'];

function MonthNav({ year, month, onPrev, onNext }) {
  return (
    <div className="schedule-month-nav">
      <button type="button" className="schedule-nav-button" onClick={onPrev} aria-label="이전 달">
        ‹
      </button>
      <span className="schedule-month-label">
        {year}년 {month + 1}월
      </span>
      <button type="button" className="schedule-nav-button" onClick={onNext} aria-label="다음 달">
        ›
      </button>
    </div>
  );
}

export default function ScheduleMonthView({ monthCursor, today, selectedDate, schedules, onSelect, onPrev, onNext }) {
  const weeks = getMonthGrid(monthCursor.year, monthCursor.month);
  return (
    <div className="card">
      <MonthNav year={monthCursor.year} month={monthCursor.month} onPrev={onPrev} onNext={onNext} />
      <table className="schedule-month-grid">
        <thead>
          <tr>
            {WEEKDAY_LABELS.map((label, i) => (
              <th key={label} className={`is-${WEEKDAY_HEADER_KINDS[i]}`}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0].date}>
              {week.map((cell) => {
                const dayNumber = Number(cell.date.slice(-2));
                const hasSchedule = getSchedulesForDate(schedules, cell.date).length > 0;
                const holiday = getHolidayInfo(cell.date);
                const classNames = getDayCellClassNames(cell, { today, selectedDate });
                return (
                  <td key={cell.date}>
                    <button
                      type="button"
                      className={classNames}
                      title={holiday ? holiday.name : undefined}
                      onClick={() => onSelect(cell.date)}
                    >
                      <span className="schedule-day-number">{dayNumber}</span>
                      <span className={hasSchedule ? 'schedule-day-dot has-schedule' : 'schedule-day-dot'} />
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
