// B2.4: 월간/주간 탭 전환, 반복 일정(루틴) 표시. 월간·주간 그리드는 ScheduleMonthView.jsx·
// ScheduleWeekView.jsx로 분리(eslint max-lines 여유 확보)하고, 이 화면은 탭 전환 + 두 뷰가
// 공유하는 selectedDate 상태만 관리한다.
import { useState, useRef, useEffect } from 'react';
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
  // P21 결정(사람, 2026-09-27, P16 결정 번복): "새 일정 추가" 폼이 항상 펼쳐져 있어 공간을
  // 너무 차지한다는 재요청 — 다른 화면들의 "팝업 없이 항상 보이는 입력창" 원칙을 이 화면만
  // 깨는 트레이드오프를 감수하고 접이식으로 바꾼다(사람이 그 트레이드오프를 알고도 다시
  // 요청함, work-widget-requirements.md B2.4 참고). 기본은 접힘.
  const [showAddForm, setShowAddForm] = useState(false);
  const [monthCursor, setMonthCursor] = useState(() => {
    const [y, m] = today.split('-').map(Number);
    return { year: y, month: m - 1 };
  });
  const [weekAnchor, setWeekAnchor] = useState(today);
  const [selectedDate, setSelectedDate] = useState(today);
  // P5.7 결정(사람, 2026-09-25): 트레이 재표시/자정 경과로 "오늘"이 실제로 바뀐 경우에만
  // 그리드·선택 날짜를 오늘로 리셋하고, 안 바뀌었으면 사용자가 보던 위치를 그대로 둔다.
  const [knownToday, setKnownToday] = useState(today);
  // critical-reviewer 지적(P5.4 리뷰): 겹친 저장이 옛 data로 덮어써 항목이 사라질 수 있어
  // 화면 전체 saving 가드를 둔다. state는 갱신이 다음 렌더에야 반영돼 "같은 렌더"에서 여러
  // 호출이 함께 가드를 통과할 수 있었다 — 즉시 갱신되는 savingRef로 바꿈(saving state는 폼
  // 비활성화 표시 전용). mutex로 "동시 실행"은 막아도 대기하던 호출이 나중에 통과할 때 자기
  // 생성 시점의 data 클로저를 쓰는 문제는 남는다(P17에서 Playwright로 재현) — dataRef를 두고
  // 각 핸들러가 setData 직후 dataRef.current도 바로 갱신해(useEffect만으로는 다음 커밋까지
  // 지연돼 부족했음) 모든 핸들러가 닫힌 매개변수 data 대신 dataRef.current 기준으로 계산하게
  // 한다.
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  function beginSaving() {
    savingRef.current = true;
    setSaving(true);
  }
  function endSaving() {
    savingRef.current = false;
    setSaving(false);
  }
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

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

  async function handleAddSchedule({ title, date, isRecurring, recurrenceDays, categoryId }) {
    if (savingRef.current) throw new Error('저장이 진행 중입니다. 잠시 후 다시 시도하세요.');
    beginSaving();
    try {
      const nextSchedules = [
        ...dataRef.current.schedules,
        createSchedule({ title, date, isRecurring, recurrenceDays, categoryId }),
      ];
      const newData = { ...dataRef.current, schedules: nextSchedules };
      await window.api.saveData(newData);
      dataRef.current = newData;
      setData(newData);
    } finally {
      endSaving();
    }
  }

  async function handleEditSchedule(scheduleId, updates) {
    if (savingRef.current) throw new Error('저장이 진행 중입니다. 잠시 후 다시 시도하세요.');
    beginSaving();
    try {
      const nextSchedules = applyScheduleUpdate(dataRef.current.schedules, scheduleId, updates);
      const newData = { ...dataRef.current, schedules: nextSchedules };
      await window.api.saveData(newData);
      dataRef.current = newData;
      setData(newData);
    } finally {
      endSaving();
    }
  }

  async function handleDeleteSchedule(scheduleId) {
    if (savingRef.current) throw new Error('저장이 진행 중입니다. 잠시 후 다시 시도하세요.');
    beginSaving();
    try {
      const nextSchedules = removeSchedule(dataRef.current.schedules, scheduleId);
      const newData = { ...dataRef.current, schedules: nextSchedules };
      await window.api.saveData(newData);
      dataRef.current = newData;
      setData(newData);
    } finally {
      endSaving();
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
          categories={data.schedule_categories}
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
          categories={data.schedule_categories}
          onSelect={setSelectedDate}
          onPrev={() => goToWeek(-1)}
          onNext={() => goToWeek(1)}
        />
      )}
      {/* P12.17: 점 색이 이제 반복/일회성이 아니라 카테고리 색을 담는다 — 점 색=카테고리 부분만
          사용자가 참고로 든 routine-planner의 캘린더 방식에서 가져왔고, 반복 표시용 테두리
          링은 그 앱에는 없는 이 프로젝트만의 추가 결정이다(routine-planner는 반복 여부를 점과
          별개로 표시하지 않음 — critical-reviewer 지적, 출처 오기 정정: scheduleGrid.js/
          index.css/work-widget-requirements.md는 이미 정정, 여기 남아있던 것도 정정).
          색 하나하나의 이름(카테고리 이름)까지 여기 다 나열하면 카테고리가 많을 때 줄이 너무
          길어지므로, 이름은 '설정' 탭(P15로 이동)에서 확인하도록 하고 여기는 "점=카테고리,
          테두리=반복, 빈 점=미분류"라는 규칙만 짧게 안내한다. */}
      <p className="schedule-dot-legend">
        <span className="schedule-dot-legend-item">
          <span className="schedule-day-dot is-blue" /> 점 색 = 카테고리(설정 탭 참고)
        </span>
        <span className="schedule-dot-legend-item">
          <span className="schedule-day-dot is-blue is-recurring-ring" /> 테두리 = 반복 일정
        </span>
        {/* critical-reviewer 지적(2차 재검증, Medium): 빈 점(미분류)의 의미가 범례 어디에도
            없어서 반복 테두리와 헷갈릴 수 있었다 — 항목을 추가한다. */}
        <span className="schedule-dot-legend-item">
          <span className="schedule-day-dot is-none" /> 빈 점 = 미분류
        </span>
      </p>
      {/* P16: 날짜 상세 목록을 캘린더 바로 다음에 둔다(가독성 피드백). */}
      <ScheduleDateDetail
        date={selectedDate}
        schedules={data.schedules}
        categories={data.schedule_categories}
        onEdit={handleEditSchedule}
        onDelete={handleDeleteSchedule}
        disabled={saving}
      />
      {/* P21: "새 일정 추가" 폼을 기본 접힘 + 버튼 클릭 시 펼침으로(공간 절약 요청).
          critical-reviewer 지적(Medium): 저장 중(saving)에 이 버튼으로 폼을 접으면
          ScheduleAddForm이 언마운트되어 저장 실패 시 에러 문구를 보여줄 곳이 없어진다 —
          저장 중에는 접지 못하게 막는다(폼 안의 다른 입력/버튼도 disabled={saving}으로
          이미 막혀 있어 저장 중 조작 자체가 원래 불가능했던 것과 일관됨). */}
      <button
        type="button"
        className="schedule-category-manager-toggle"
        onClick={() => setShowAddForm((v) => !v)}
        aria-expanded={showAddForm}
        disabled={saving}
      >
        {showAddForm ? '새 일정 추가 닫기 ▲' : '+ 새 일정 추가 ▼'}
      </button>
      {showAddForm && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">새 일정 추가</h2>
          </div>
          <ScheduleAddForm
            defaultDate={selectedDate}
            onAdd={handleAddSchedule}
            categories={data.schedule_categories}
            disabled={saving}
          />
        </div>
      )}
    </>
  );
}
