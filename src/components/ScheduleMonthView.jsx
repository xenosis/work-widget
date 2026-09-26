// Schedule.jsx(P5.2)에서 분리 — 월간 그리드 전용. eslint max-lines 여유 확보 목적도 있음
// (ProjectDetail/ProjectEditForm 분리와 같은 이유).
import {
  getMonthGrid,
  getScheduleCellSummary,
  getScheduleDotClassName,
  getHolidayInfo,
  getDayCellClassNames,
  buildScheduleCellTooltip,
} from '../lib/scheduleGrid.js';

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
// P12.6: 헤더는 요일 라벨이 고정 배열이라 날짜 계산 없이도 순서로 토/일을 알 수 있다 — 셀은
// 인접 달까지 섞여 있어 라벨 순서만으로는 판정할 수 없으므로 getWeekdayKind(cell.date)를 쓴다.
// P18: 일요일 시작으로 뒤집으면서 순서도 일-토로 맞춘다.
const WEEKDAY_HEADER_KINDS = ['sunday', 'weekday', 'weekday', 'weekday', 'weekday', 'weekday', 'saturday'];

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

export default function ScheduleMonthView({
  monthCursor,
  today,
  selectedDate,
  schedules,
  categories,
  onSelect,
  onPrev,
  onNext,
}) {
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
                const summary = getScheduleCellSummary(schedules, cell.date, categories);
                const holiday = getHolidayInfo(cell.date);
                const classNames = getDayCellClassNames(cell, { today, selectedDate });
                const tooltip = buildScheduleCellTooltip(holiday?.name, summary.titles);
                // critical-reviewer 지적(P12.9 재검증, High): title은 마우스 호버에서만 보이고
                // 키보드/스크린리더로는 안 드러난다. 게다가 새로 넣은 "+N" 텍스트가 버튼의
                // 접근 가능한 이름에 그대로 섞여 "26+1"처럼 읽히는 회귀가 생겼다 — 점/overflow
                // 영역은 aria-hidden으로 이름 계산에서 빼고, 일정 개수를 aria-label로 명시한다.
                const ariaLabel = `${dayNumber}일${summary.count > 0 ? `, 일정 ${summary.count}개` : ''}`;
                return (
                  <td key={cell.date}>
                    <button
                      type="button"
                      className={classNames}
                      title={tooltip}
                      aria-label={ariaLabel}
                      onClick={() => onSelect(cell.date)}
                    >
                      <span className="schedule-day-number" aria-hidden="true">
                        {dayNumber}
                      </span>
                      <span className="schedule-day-dots" aria-hidden="true">
                        {summary.dots.map((dot, i) => (
                          <span key={i} className={getScheduleDotClassName(dot)} />
                        ))}
                        {summary.overflowCount > 0 && (
                          <span className="schedule-day-overflow">+{summary.overflowCount}</span>
                        )}
                      </span>
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
