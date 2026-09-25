// B2.4: 월간/주간 탭 전환, 반복 일정(루틴) 표시
// P5.2/P5.3: 월간·주간 그리드는 src/components/ScheduleMonthView.jsx·ScheduleWeekView.jsx로
// 분리(eslint max-lines 여유 확보, ProjectDetail/ProjectEditForm 분리와 같은 이유)하고, 이
// 화면은 탭 전환 + 두 뷰가 공유하는 selectedDate 상태만 관리한다.
import { useState } from 'react';
import { useAppData } from '../lib/useAppData.js';
import { getTodayDateString } from '../lib/dateRange.js';
import { shiftMonth, shiftDate, getWeekDates, todayResetCursors } from '../lib/scheduleGrid.js';
import { ScheduleIcon } from '../components/icons.jsx';
import ScheduleMonthView from '../components/ScheduleMonthView.jsx';
import ScheduleWeekView from '../components/ScheduleWeekView.jsx';
import ScheduleDateDetail from '../components/ScheduleDateDetail.jsx';
import ScheduleAddForm from '../components/ScheduleAddForm.jsx';
import { createSchedule } from '../lib/scheduleFactory.js';
import { applyScheduleUpdate, removeSchedule } from '../lib/scheduleMutations.js';

export default function Schedule() {
  const { apiAvailable, data, error, setData } = useAppData();
  const today = getTodayDateString();
  const [view, setView] = useState('month');
  const [monthCursor, setMonthCursor] = useState(() => {
    const [y, m] = today.split('-').map(Number);
    return { year: y, month: m - 1 };
  });
  const [weekAnchor, setWeekAnchor] = useState(today);
  const [selectedDate, setSelectedDate] = useState(today);
  // P5.7 결정(사람, 2026-09-25): 트레이 재표시/자정 경과로 "오늘"이 실제로 바뀐 경우에만
  // 그리드·선택 날짜를 오늘로 리셋하고, 안 바뀌었으면 사용자가 보던 위치를 그대로 둔다.
  const [knownToday, setKnownToday] = useState(today);
  // critical-reviewer 지적(P5.4 리뷰): 추가/수정/삭제가 각자 로컬 saving만 가지면 IPC 저장이
  // 진행 중인 사이 다른 저장이 겹쳐 들어가 옛 data로 나중 저장을 덮어써 방금 만든/지운 일정이
  // 조용히 사라질 수 있다 — Todos.jsx와 동일하게 화면 전체 saving 가드를 둔다.
  const [saving, setSaving] = useState(false);

  if (!apiAvailable) {
    return (
      <>
        <h1>일정</h1>
        <div className="empty-state-card">
          <p>window.api를 사용할 수 없습니다 (Electron 렌더러 밖에서 실행 중).</p>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <h1>일정</h1>
        <div className="empty-state-card">
          <p>데이터를 불러오지 못했습니다: {error}</p>
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <h1>일정</h1>
        <div className="empty-state-card">
          <ScheduleIcon />
          <p>불러오는 중...</p>
        </div>
      </>
    );
  }

  // P5.7: React의 "렌더 중 상태 조정" 패턴(useEffect 없이, 이전 값과 비교해 다르면 그 자리에서
  // setState) — data:changed로 재렌더될 때마다 today를 다시 계산하는데, knownToday와 다르면
  // 트레이 재표시나 자정 경과로 실제 날짜가 바뀐 것이므로 그리드·선택 날짜를 오늘로 리셋한다.
  // 같으면(화면 전환, 저장 후 재렌더 등 날짜와 무관한 재렌더) 사용자가 보던 위치를 그대로 둔다.
  if (knownToday !== today) {
    setKnownToday(today);
    const reset = todayResetCursors(today);
    setSelectedDate(reset.selectedDate);
    setMonthCursor(reset.monthCursor);
    setWeekAnchor(reset.weekAnchor);
  }

  // critical-reviewer 지적(P5.2 리뷰): 월/주를 이동해도 selectedDate가 그대로 남으면 상세
  // 카드가 지금 보이는 그리드에 없는 날짜를 가리키는 상태가 된다 — 이동한 월/주가 오늘을
  // 포함하면 오늘로, 아니면 그 월의 1일/그 주의 첫날로 selectedDate를 맞춘다. (P5.7 리뷰
  // 지적: 여기서 참조하는 today는 이 렌더 시작 시점 값이라, 자정을 넘긴 직후 재렌더가 오기
  // 전에 사용자가 이 버튼을 누르면 어제 기준으로 계산된다 — 곧이어 오는 재렌더가 knownToday
  // 리셋으로 그 결과를 오늘 기준으로 다시 덮어써서 첫 클릭이 무시된 것처럼 보일 수 있다.
  // 하루 한 번, 자정 직후 아주 짧은 창에서만 가능한 드문 경우라 알려진 동작으로 남긴다.)
  function goToMonth(delta) {
    const next = shiftMonth(monthCursor, delta);
    setMonthCursor(next);
    const [ty, tm] = today.split('-').map(Number);
    setSelectedDate(
      next.year === ty && next.month === tm - 1 ? today : `${next.year}-${String(next.month + 1).padStart(2, '0')}-01`
    );
  }

  function goToWeek(delta) {
    const next = shiftDate(weekAnchor, delta * 7);
    setWeekAnchor(next);
    const nextWeekDates = getWeekDates(next);
    setSelectedDate(nextWeekDates.includes(today) ? today : nextWeekDates[0]);
  }

  // critical-reviewer 지적(P5.3 리뷰): 위 스냅은 이전/다음 버튼 경로에서만 동작하고, 탭
  // 자체를 눌러 전환하는 경로에는 없었다 — 주간에서 여러 주 이동한 뒤 월간으로 돌아가면
  // 그리드가 selectedDate와 무관한 달을 보여주는(반대 방향도 마찬가지) 문제가 재현됐다.
  // 탭을 누를 때 selectedDate를 기준으로 다른 뷰의 커서를 맞춘다.
  function switchToMonth() {
    const [y, m] = selectedDate.split('-').map(Number);
    setMonthCursor({ year: y, month: m - 1 });
    setView('month');
  }

  function switchToWeek() {
    setWeekAnchor(selectedDate);
    setView('week');
  }

  async function handleAddSchedule({ title, date, isRecurring, recurrenceDays }) {
    if (saving) throw new Error('저장이 진행 중입니다. 잠시 후 다시 시도하세요.');
    setSaving(true);
    try {
      const nextSchedules = [...data.schedules, createSchedule({ title, date, isRecurring, recurrenceDays })];
      const newData = { ...data, schedules: nextSchedules };
      await window.api.saveData(newData);
      setData(newData);
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSchedule(scheduleId, updates) {
    if (saving) throw new Error('저장이 진행 중입니다. 잠시 후 다시 시도하세요.');
    setSaving(true);
    try {
      const nextSchedules = applyScheduleUpdate(data.schedules, scheduleId, updates);
      const newData = { ...data, schedules: nextSchedules };
      await window.api.saveData(newData);
      setData(newData);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSchedule(scheduleId) {
    if (saving) throw new Error('저장이 진행 중입니다. 잠시 후 다시 시도하세요.');
    setSaving(true);
    try {
      const nextSchedules = removeSchedule(data.schedules, scheduleId);
      const newData = { ...data, schedules: nextSchedules };
      await window.api.saveData(newData);
      setData(newData);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <h1>일정</h1>
      <div className="schedule-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'month'}
          className={view === 'month' ? 'schedule-tab active' : 'schedule-tab'}
          onClick={switchToMonth}
        >
          월간
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'week'}
          className={view === 'week' ? 'schedule-tab active' : 'schedule-tab'}
          onClick={switchToWeek}
        >
          주간
        </button>
      </div>
      {view === 'month' ? (
        <ScheduleMonthView
          monthCursor={monthCursor}
          today={today}
          selectedDate={selectedDate}
          schedules={data.schedules}
          onSelect={setSelectedDate}
          onPrev={() => goToMonth(-1)}
          onNext={() => goToMonth(1)}
        />
      ) : (
        <ScheduleWeekView
          weekAnchor={weekAnchor}
          today={today}
          selectedDate={selectedDate}
          schedules={data.schedules}
          onSelect={setSelectedDate}
          onPrev={() => goToWeek(-1)}
          onNext={() => goToWeek(1)}
        />
      )}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">새 일정 추가</h2>
        </div>
        <ScheduleAddForm defaultDate={selectedDate} onAdd={handleAddSchedule} disabled={saving} />
      </div>
      <ScheduleDateDetail
        date={selectedDate}
        schedules={data.schedules}
        onEdit={handleEditSchedule}
        onDelete={handleDeleteSchedule}
        disabled={saving}
      />
    </>
  );
}
