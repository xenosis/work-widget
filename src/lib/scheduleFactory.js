// B3.4 스키마를 만족하는 새 Schedule 레코드 생성. todoFactory.js/memoFactory.js와 같은 이유로
// 화면(Schedule.jsx) 안에 인라인으로 두지 않고 분리한다 — 저장되는 객체가 스키마 필드를
// 정확히 채우는지 vitest로 검증 가능해야 한다.
export function createSchedule({ title, date, isRecurring, recurrenceDays, categoryId }, now = new Date().toISOString()) {
  return {
    id: `schedule-${crypto.randomUUID()}`,
    title,
    date,
    is_recurring: isRecurring,
    // B3.4: recurrence_days는 is_recurring이 true일 때만 사용 — 일회성 일정은 null로 둬서
    // getSchedulesForDate(scheduleGrid.js)의 else 분기(date만 비교)와 계약을 맞춘다.
    recurrence_days: isRecurring ? recurrenceDays : null,
    // P12.16(critical-reviewer 지적): B3.4에 category_id가 추가됐는데 이 함수가 안 채우면
    // 새로 만든 일정은 dataStore.js가 다음 로드 때 정규화로 채워주기 전까지 이 필드가 아예
    // 없는 상태로 저장된다 — 처음부터 명시적으로 채운다. P12.17: 이제 ScheduleAddForm.jsx가
    // 실제로 categoryId를 넘겨준다 — 안 넘기면(호출부 누락, 기존 테스트 등) undefined가
    // 되므로 ?? null로 명시적 미분류로 정규화한다.
    category_id: categoryId ?? null,
    created_at: now,
    updated_at: now,
  };
}
