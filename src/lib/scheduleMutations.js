// projectMutations.js/memoMutations.js와 같은 이유로 화면(Schedule.jsx) 밖으로 뺀 순수 함수.
// B3.4: "반복 일정 수정 시 이 규칙 자체가 갱신되며, 이후 모든 회차에 일괄 반영" — 회차별
// 레코드가 따로 없으므로(getSchedulesForDate가 매번 이 레코드 하나로 노출 여부를 계산) 이
// 함수로 레코드 하나만 바꾸면 그 요구사항이 별도 로직 없이 성립한다(applyProjectUpdate와
// 동일하게 호출자가 배열을 신뢰).
export function applyScheduleUpdate(schedules, scheduleId, updates, now = new Date().toISOString()) {
  return schedules.map((s) => (s && s.id === scheduleId ? { ...s, ...updates, updated_at: now } : s));
}

// B2.4: "반복 일정 삭제 시 이후 모든 회차가 함께 사라짐" — 회차별 레코드가 없으므로 규칙
// 레코드 하나만 지우면 모든 회차가 함께 사라진다(별도 처리 불필요).
export function removeSchedule(schedules, scheduleId) {
  return schedules.filter((s) => !(s && s.id === scheduleId));
}
