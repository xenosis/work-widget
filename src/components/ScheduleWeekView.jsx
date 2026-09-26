// P5.3: 주간 뷰. 월간 뷰(ScheduleMonthView)와 같은 셀 스타일(schedule-day-cell)을 그대로
// 재사용해 7칸을 한 줄에 펼친다 — 두 뷰가 서로 다른 마크업으로 갈라지면 CSS를 두 번 관리해야
// 하므로 공용 클래스를 그대로 쓴다.
import {
  getWeekDates,
  getDayLabel,
  getWeekdayKind,
  getHolidayInfo,
  getScheduleCellSummary,
  getScheduleDotClassName,
  buildScheduleCellTooltip,
} from '../lib/scheduleGrid.js';

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

export default function ScheduleWeekView({
  weekAnchor,
  today,
  selectedDate,
  schedules,
  categories,
  onSelect,
  onPrev,
  onNext,
}) {
  const weekDates = getWeekDates(weekAnchor);
  return (
    <div className="card">
      <WeekNav weekDates={weekDates} onPrev={onPrev} onNext={onNext} />
      <div className="schedule-week-row">
        {weekDates.map((date) => {
          const dayNumber = Number(date.slice(-2));
          const summary = getScheduleCellSummary(schedules, date, categories);
          const weekdayKind = getWeekdayKind(date);
          const holiday = getHolidayInfo(date);
          const tooltip = buildScheduleCellTooltip(holiday?.name, summary.titles);
          const classNames = ['schedule-day-cell'];
          if (weekdayKind !== 'weekday') classNames.push(`is-${weekdayKind}`);
          if (holiday) classNames.push('is-holiday');
          if (date === today) classNames.push('is-today');
          if (date === selectedDate) classNames.push('is-selected');
          // critical-reviewer 지적(Medium, P12.8 리뷰): 날짜 숫자만 is-holiday 색을 따르고
          // 요일 라벨은 weekdayKind만 보고 있어서, 토요일 공휴일은 라벨=파랑/숫자=빨강으로
          // 어긋나 보였다 — 라벨도 같은 두 클래스를 걸어 숫자와 동일한 우선순위 규칙을 탄다.
          const labelClasses = ['schedule-weekday-label'];
          if (weekdayKind !== 'weekday') labelClasses.push(`is-${weekdayKind}`);
          if (holiday) labelClasses.push('is-holiday');
          const labelClassNames = labelClasses.join(' ');
          // critical-reviewer 지적(P12.9 재검증, High): title은 호버 전용이라 키보드/스크린리더로
          // 안 드러나고, "+N" 텍스트가 접근 가능한 이름에 그대로 섞여 들어가는 회귀가 있었다 —
          // 날짜/점 표시는 aria-hidden으로 이름 계산에서 빼고 aria-label로 명시한다.
          const ariaLabel = `${getDayLabel(date)}요일 ${dayNumber}일${summary.count > 0 ? `, 일정 ${summary.count}개` : ''}`;
          return (
            <button
              key={date}
              type="button"
              className={classNames.join(' ')}
              title={tooltip}
              aria-label={ariaLabel}
              onClick={() => onSelect(date)}
            >
              <span className={labelClassNames} aria-hidden="true">
                {getDayLabel(date)}
              </span>
              <span className="schedule-day-number" aria-hidden="true">
                {dayNumber}
              </span>
              <span className="schedule-day-dots" aria-hidden="true">
                {summary.dots.map((dot, i) => (
                  <span key={i} className={getScheduleDotClassName(dot)} />
                ))}
                {summary.overflowCount > 0 && <span className="schedule-day-overflow">+{summary.overflowCount}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
