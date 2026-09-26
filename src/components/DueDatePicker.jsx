// P12.19(사용자 요청): 네이티브 <input type="date">의 달력 팝업은 Chromium이 내부적으로
// 그려서 CSS로 개별 날짜를 칠할 방법이 없다(P12.13에서 겪은 select 팝업과 같은 종류의 플랫폼
// 제약). 일정 화면(ScheduleMonthView.jsx, P12.6/P12.8)이 이미 갖고 있는 월간 그리드 렌더링과
// 주말/공휴일 판정(scheduleGrid.js)을 그대로 재사용해, 프로젝트/할일의 마감일 입력을 이
// 컴포넌트로 교체한다 — 트리거 버튼을 누르면 팝오버로 월간 그리드가 뜨고, 날짜를 클릭하면
// 값이 선택되며 팝오버가 닫힌다.
// P12.15: 이름/기본 문구('마감일 지우기')는 원래 목적(마감일) 그대로지만, ScheduleAddForm.jsx/
// ScheduleEditForm.jsx가 "마감일"이 아닌 다른 의미의 날짜(일정 날짜, 반복 기준일)에도 이
// 컴포넌트를 재사용한다 — 다만 그 두 곳은 날짜가 필수 입력이라 지우기 버튼 자체를 꺼두므로
// (clearable=false) 문구가 실제로 보일 일이 없다. ariaLabel은 호출부가 지정하고,
// popoverAlign/clearable로 배치·필수 여부를 커스터마이즈한다.
import { useState, useRef, useEffect } from 'react';
import { getMonthGrid, getHolidayInfo, getDayCellClassNames, shiftMonth } from '../lib/scheduleGrid.js';
import { getTodayDateString, isValidDateString } from '../lib/dateRange.js';
import { ScheduleIcon } from './icons.jsx';

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
const WEEKDAY_HEADER_KINDS = ['weekday', 'weekday', 'weekday', 'weekday', 'weekday', 'saturday', 'sunday'];

// critical-reviewer 지적(High): ProjectEditForm처럼 값을 형식 검증 없이 그대로 넘기는 호출부가
// 있으면(손상된 data.json 등) 아래 monthCursorFor의 split이 TypeError를 던지고, 이 앱엔
// ErrorBoundary가 없어 화면 전체가 빈 화면이 됐다 — 컴포넌트 진입점에서 한 번만 검증해 모든
// 호출부를 방어한다(각 폼에서 개별로 막지 않아도 됨). critical-reviewer 지적(재검증 2라운드,
// Medium): isValidDateString(왕복 검증 포함)을 이 파일에만 두면, TodoEditForm.jsx/
// ProjectEditForm.jsx의 state 정리 로직이 같은 판정을 못 쓰고 형태 검사(DATE_STRING_RE)만 하게
// 돼서 "화면은 빈칸인데 저장은 깨진 값 그대로" 결함이 재발했다 — dateRange.js로 옮겨 세 곳이
// 모두 같은 함수를 쓰게 한다.
function monthCursorFor(dateString) {
  const base = isValidDateString(dateString) ? dateString : getTodayDateString();
  const [y, m] = base.split('-').map(Number);
  return { year: y, month: m - 1 };
}

// critical-reviewer 지적(P12.15 재검증, High): P12.19의 5곳은 모두 트리거가 한 행의 오른쪽
// 끝(제목 입력 옆)에 있어 팝오버를 트리거 오른쪽 끝 기준 왼쪽으로 펼치면(right:0) 항상 폭
// 안에 들어왔다 — 그런데 ScheduleAddForm.jsx/ScheduleEditForm.jsx는 트리거가 행의 왼쪽 끝에
// 있어서 같은 방식이면 팝오버가 사이드바 영역까지 넘어가 월/화 요일 칸이 사이드바에 가려
// 안 보였다(Playwright 스크린샷으로 확인). popoverAlign으로 방향을 고를 수 있게 한다 —
// 기본값 'right'는 기존 5곳과 하위 호환.
export default function DueDatePicker({
  value,
  onChange,
  disabled = false,
  ariaLabel = '마감일(선택)',
  popoverAlign = 'right',
  // critical-reviewer 지적(재검증, Medium): 일정 화면의 날짜는 필수 입력인데 지우기 버튼을
  // 누르면 빈 값이 됐다가 제출 시 "날짜를 선택하세요" 오류만 나는 무의미한 경로였다 —
  // 선택 입력(마감일 등)에서만 지우기를 보여주고, 필수 입력 호출부는 꺼둘 수 있게 한다.
  clearable = true,
}) {
  const safeValue = isValidDateString(value) ? value : '';
  const [open, setOpen] = useState(false);
  const [monthCursor, setMonthCursor] = useState(() => monthCursorFor(safeValue));
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const today = getTodayDateString();

  // 팝오버 바깥 클릭/Escape로 닫힘(done_when 요구사항) — 네이티브 select/date와 달리 이건
  // 우리가 그리는 DOM이라 브라우저가 대신 처리해주지 않는다. Escape는 트리거로 포커스를
  // 되돌린다(critical-reviewer 지적: 안 그러면 키보드 사용자가 포커스를 잃음) — 바깥 클릭은
  // 사용자가 다른 곳으로 이동하려는 의도이므로 포커스를 되돌리지 않는다.
  useEffect(() => {
    if (!open) return undefined;
    function handlePointerDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function toggleOpen() {
    if (disabled) return;
    if (!open) setMonthCursor(monthCursorFor(safeValue));
    setOpen((o) => !o);
  }

  function selectDate(dateString) {
    onChange(dateString);
    setOpen(false);
    triggerRef.current?.focus();
  }

  // critical-reviewer 지적(Medium): Tab으로 팝오버 밖으로 포커스가 나가도 그동안은 안 닫혀서,
  // 같은 화면에 여러 DueDatePicker가 있으면(예: ProjectDetail의 요약 수정 폼 + 할일 추가 폼)
  // 키보드만으로 두 팝오버가 동시에 열릴 수 있었다 — 포커스가 컨테이너 밖으로 완전히 벗어날
  // 때만 닫는다(relatedTarget이 없는 경우, 예: 마우스로 탭 밖 다른 창을 클릭하는 경우는 열어
  // 둔다 — 그 경우는 위 mousedown 핸들러가 이미 처리한다).
  function handleBlur(e) {
    if (e.relatedTarget && containerRef.current?.contains(e.relatedTarget)) return;
    if (e.relatedTarget) setOpen(false);
  }

  const weeks = getMonthGrid(monthCursor.year, monthCursor.month);

  return (
    <div className="due-date-picker" ref={containerRef} onBlur={handleBlur}>
      <button
        ref={triggerRef}
        type="button"
        className="due-date-trigger"
        disabled={disabled}
        onClick={toggleOpen}
        aria-label={safeValue ? `${ariaLabel}: ${safeValue}` : ariaLabel}
        aria-expanded={open}
      >
        <ScheduleIcon width={14} height={14} />
        <span className={safeValue ? '' : 'due-date-placeholder'}>{safeValue || '날짜 선택'}</span>
      </button>
      {open && (
        <div
          className={popoverAlign === 'left' ? 'due-date-popover due-date-popover--left' : 'due-date-popover'}
          role="dialog"
          aria-label={ariaLabel}
        >
          <div className="schedule-month-nav">
            <button
              type="button"
              className="schedule-nav-button"
              onClick={() => setMonthCursor((c) => shiftMonth(c, -1))}
              aria-label="이전 달"
            >
              ‹
            </button>
            <span className="schedule-month-label">
              {monthCursor.year}년 {monthCursor.month + 1}월
            </span>
            <button
              type="button"
              className="schedule-nav-button"
              onClick={() => setMonthCursor((c) => shiftMonth(c, 1))}
              aria-label="다음 달"
            >
              ›
            </button>
          </div>
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
                    const holiday = getHolidayInfo(cell.date);
                    const classNames = getDayCellClassNames(cell, { today, selectedDate: safeValue });
                    return (
                      <td key={cell.date}>
                        <button
                          type="button"
                          className={classNames}
                          title={holiday ? holiday.name : undefined}
                          onClick={() => selectDate(cell.date)}
                        >
                          <span className="schedule-day-number">{dayNumber}</span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {clearable && safeValue && (
            <button type="button" className="due-date-clear" onClick={() => selectDate('')}>
              마감일 지우기
            </button>
          )}
        </div>
      )}
    </div>
  );
}
