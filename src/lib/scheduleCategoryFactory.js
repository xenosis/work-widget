// B3.4 스키마를 만족하는 새 ScheduleCategory 레코드 생성 — scheduleFactory.js와 같은 이유로
// 분리한다(저장되는 객체가 스키마 필드를 정확히 채우는지 vitest로 검증 가능해야 함).
import { normalizeCategoryColor } from './categoryPalette.js';

export function createScheduleCategory({ name, color }, now = new Date().toISOString()) {
  return {
    id: `category-${crypto.randomUUID()}`,
    name,
    color: normalizeCategoryColor(color),
    created_at: now,
    updated_at: now,
  };
}
