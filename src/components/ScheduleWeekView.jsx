// P5.3: 주간 뷰. 월간 뷰(ScheduleMonthView)와 같은 셀 스타일(schedule-day-cell)을 그대로
// 재사용해 7칸을 한 줄에 펼친다 — 두 뷰가 서로 다른 마크업으로 갈라지면 CSS를 두 번 관리해야
// 하므로 공용 클래스를 그대로 쓴다.
import { getWeekDates, getDayLabel, getSchedulesForDate } from '../lib/scheduleGrid.js';

// "YYYY-MM-DD ~ YYYY-MM-DD"(23자)는 420px 폭 네비 라벨에서 줄바꿈될 위험이 있어(critical-reviewer
// 지적) "M/D ~ M/D"로 줄인다.
function shortLabel(dateString) {
  const [, m, d] = dateString.split('-');
  return `${Number(m)}/${Number(d)}`;
}

function WeekNav({ weekDates, onPrev, onNext }) {
  return (
    <div className="schedule-month-nav">
      <button type="button" className="schedule-nav-button" onClick={onPrev} aria-label="이전 주">
        ‹
      </button>
      <span className="schedule-month-label">
        {shortLabel(weekDates[0])} ~ {shortLabel(weekDates[6])}
      </span>
      <button type="button" className="schedule-nav-button" onClick={onNext} aria-label="다음 주">
        ›
      </button>
    </div>
  );
}

export default function ScheduleWeekView({ weekAnchor, today, selectedDate, schedules, onSelect, onPrev, onNext }) {
  const weekDates = getWeekDates(weekAnchor);
  return (
    <div className="card">
      <WeekNav weekDates={weekDates} onPrev={onPrev} onNext={onNext} />
      <div className="schedule-week-row">
        {weekDates.map((date) => {
          const dayNumber = Number(date.slice(-2));
          const hasSchedule = getSchedulesForDate(schedules, date).length > 0;
          const classNames = ['schedule-day-cell'];
          if (date === today) classNames.push('is-today');
          if (date === selectedDate) classNames.push('is-selected');
          return (
            <button key={date} type="button" className={classNames.join(' ')} onClick={() => onSelect(date)}>
              <span className="schedule-weekday-label">{getDayLabel(date)}</span>
              <span className="schedule-day-number">{dayNumber}</span>
              <span className={hasSchedule ? 'schedule-day-dot has-schedule' : 'schedule-day-dot'} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
