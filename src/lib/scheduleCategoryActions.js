// Schedule.jsx가 eslint max-lines(300)에 근접해(P12.16으로 카테고리 CRUD 핸들러 3개가
// 추가되면서 넘어감) 이 파일로 뺀다 — ProjectDetail/ProjectEditForm 분리와 같은 이유.
// (P15에서 카테고리 관리 UI 자체가 Schedule.jsx에서 설정 탭(src/screens/Settings.jsx)으로
// 옮겨져, 지금은 Settings.jsx가 이 팩토리를 호출한다 — 파일 분리 이유였던 max-lines 근거는
// 더 이상 Schedule.jsx가 아니라 Settings.jsx에 적용된다.)
// data/setData/saving/setSaving은 호출부(Settings.jsx)가 그대로 들고 있는 상태라 이 팩토리가
// 그 참조를 그대로 받아 쓴다(새 상태를 따로 만들지 않음 — "저장 호출 지점 하나" 전제 유지).
// 이름을 createScheduleCategoryActions로 둔 이유: 내부에서 useState/useEffect 등 실제 React
// 훅을 쓰지 않는 평범한 함수라 "use" 접두어를 붙이면 eslint(react-hooks/rules-of-hooks)가
// 호출부의 조건부 early return 이후 호출을 훅 규칙 위반으로 오인해 에러를 낸다.
import { createScheduleCategory } from './scheduleCategoryFactory.js';
import { applyCategoryUpdate, removeCategory, unassignCategoryFromSchedules } from './scheduleCategoryMutations.js';

export function createScheduleCategoryActions({ data, setData, saving, setSaving }) {
  async function handleAddCategory({ name, color }) {
    if (saving) throw new Error('저장이 진행 중입니다. 잠시 후 다시 시도하세요.');
    setSaving(true);
    try {
      const nextCategories = [...data.schedule_categories, createScheduleCategory({ name, color })];
      const newData = { ...data, schedule_categories: nextCategories };
      await window.api.saveData(newData);
      setData(newData);
    } finally {
      setSaving(false);
    }
  }

  async function handleEditCategory(categoryId, updates) {
    if (saving) throw new Error('저장이 진행 중입니다. 잠시 후 다시 시도하세요.');
    setSaving(true);
    try {
      const nextCategories = applyCategoryUpdate(data.schedule_categories, categoryId, updates);
      const newData = { ...data, schedule_categories: nextCategories };
      await window.api.saveData(newData);
      setData(newData);
    } finally {
      setSaving(false);
    }
  }

  // P12.16 done_when: 카테고리 삭제 시 그 카테고리를 쓰던 일정은 "미분류"로 되돌아간다 —
  // 카테고리 배열과 일정 배열을 같은 저장 호출 한 번에 함께 갱신한다(useAppData.js 주석의
  // "저장 호출 지점이 하나뿐이어야 안전" 전제를 유지하기 위해, 두 번의 별도 saveData 대신).
  async function handleDeleteCategory(categoryId) {
    if (saving) throw new Error('저장이 진행 중입니다. 잠시 후 다시 시도하세요.');
    setSaving(true);
    try {
      const nextCategories = removeCategory(data.schedule_categories, categoryId);
      const nextSchedules = unassignCategoryFromSchedules(data.schedules, categoryId);
      const newData = { ...data, schedule_categories: nextCategories, schedules: nextSchedules };
      await window.api.saveData(newData);
      setData(newData);
    } finally {
      setSaving(false);
    }
  }

  return { handleAddCategory, handleEditCategory, handleDeleteCategory };
}
