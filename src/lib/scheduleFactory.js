// B3.4 스키마를 만족하는 새 Schedule 레코드 생성. todoFactory.js/memoFactory.js와 같은 이유로
// 화면(Schedule.jsx) 안에 인라인으로 두지 않고 분리한다 — 저장되는 객체가 스키마 필드를
// 정확히 채우는지 vitest로 검증 가능해야 한다.
export function createSchedule({ title, date, isRecurring, recurrenceDays }, now = new Date().toISOString()) {
  return {
    id: `schedule-${crypto.randomUUID()}`,
    title,
    date,
    is_recurring: isRecurring,
    // B3.4: recurrence_days는 is_recurring이 true일 때만 사용 — 일회성 일정은 null로 둬서
    // getSchedulesForDate(scheduleGrid.js)의 else 분기(date만 비교)와 계약을 맞춘다.
    recurrence_days: isRecurring ? recurrenceDays : null,
    created_at: now,
    updated_at: now,
  };
}
