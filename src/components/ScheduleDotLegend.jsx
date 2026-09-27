// P12.17: 점 색=카테고리(설정 탭에 이름), 테두리=반복 일정. P28: 백로그 유래 점 스타일도 추가.
// 사용자 요청(2026-09-27): 항상 펼쳐진 채로 캘린더 아래 내용을 가릴 수 있어, 클릭하면 접혀서
// 안 보이게도 할 수 있는 토글로 바꾼다 — Schedule.jsx의 새 일정 추가 토글(P21)과 같은 패턴.
import { useState } from 'react';

export default function ScheduleDotLegend() {
  const [showLegend, setShowLegend] = useState(true);
  return (
    <>
      <button
        type="button"
        className="schedule-legend-toggle"
        onClick={() => setShowLegend((v) => !v)}
        aria-expanded={showLegend}
      >
        {showLegend ? '범례 숨기기 ▲' : '범례 보기 ▼'}
      </button>
      {showLegend && (
        <p className="schedule-dot-legend">
          <span className="schedule-dot-legend-item">
            <span className="schedule-day-dot is-blue" /> 점 색 = 카테고리(설정 탭 참고)
          </span>
          <span className="schedule-dot-legend-item">
            <span className="schedule-day-dot is-blue is-recurring-ring" /> 테두리 = 반복 일정
          </span>
          <span className="schedule-dot-legend-item">
            <span className="schedule-day-dot is-backlog" /> 백로그 목표일(읽기 전용)
          </span>
          <span className="schedule-dot-legend-item">
            <span className="schedule-day-dot is-none" /> 빈 점 = 미분류
          </span>
        </p>
      )}
    </>
  );
}
