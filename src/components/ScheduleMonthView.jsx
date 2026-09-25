// Schedule.jsx(P5.2)에서 분리 — 월간 그리드 전용. eslint max-lines 여유 확보 목적도 있음
// (ProjectDetail/ProjectEditForm 분리와 같은 이유).
import { getMonthGrid, getSchedulesForDate } from '../lib/scheduleGrid.js';

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

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
            {WEEKDAY_LABELS.map((label) => (
              <th key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0].date}>
              {week.map((cell) => {
                const dayNumber = Number(cell.date.slice(-2));
                const hasSchedule = getSchedulesForDate(schedules, cell.date).length > 0;
                const classNames = ['schedule-day-cell'];
                if (!cell.inCurrentMonth) classNames.push('is-outside');
                if (cell.date === today) classNames.push('is-today');
                if (cell.date === selectedDate) classNames.push('is-selected');
                return (
                  <td key={cell.date}>
                    <button type="button" className={classNames.join(' ')} onClick={() => onSelect(cell.date)}>
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
