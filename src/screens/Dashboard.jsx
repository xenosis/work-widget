// B1.2: 초기 진입 화면 — 오늘의 할일 요약 대시보드
// P1.5: window.api.loadData()로 실제 data.json을 불러온다.
// P1.4: 오늘 일정은 scheduleGrid.js(P5.1)의 getSchedulesForDate를 Schedule.jsx와 공유해서
// 계산한다 — 일회성/반복 규칙 전개 로직을 화면마다 따로 두지 않기 위함.
import { calculateProjectProgress, progressBarWidth } from '../lib/projectProgress.js';
import { getTodayDateString, getThisWeekRange, isThisWeekExcludingToday } from '../lib/dateRange.js';
import { getSchedulesForDate, isScheduleRecurring } from '../lib/scheduleGrid.js';
import { useAppData } from '../lib/useAppData.js';
import { priorityRank, compareByDueDateThenPriority } from '../lib/priority.js';
import TodoRow from '../components/TodoRow.jsx';

// B4.2: 마감일이 같으면 우선순위(상→중→하) 순. id 없는 레코드는 React key로 못 쓰므로 제외한다
// (electron/dataStore.js의 normalizeData는 배열/객체 여부만 보장하고 필드 단위 검증은 하지 않음).
function getTodayDueTodos(todos, today) {
  return (Array.isArray(todos) ? todos : [])
    .filter((t) => t && typeof t.id === 'string' && t.due_date === today)
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
}

// B1.2 "이번주 마감인 할일 목록" — 오늘은 제외(P1.1이 별도로 다룸), 그 외 이번주(월~일,
// src/lib/dateRange.js) 범위는 이미 지난 날짜(예: 오늘이 수요일이면 월/화 마감)도 포함한다.
// B4.1이 "마감 임박 할일은 대시보드에서 확인하는 방식으로 충분"이라고 대시보드를 유일한 확인
// 경로로 규정해서, 이미 지났다고 빼면 그 할일을 확인할 방법이 없어진다. 판정/정렬 모두
// src/lib(dateRange.js/priority.js)의 공유 함수를 쓴다 — Todos.jsx(P3.1)와 같은 정의를
// 유지하기 위함(각자 조건식을 복붙하면 한쪽만 고쳤을 때 조용히 갈라진다).
function getThisWeekDueTodos(todos, today, weekRange) {
  return (Array.isArray(todos) ? todos : [])
    .filter((t) => t && typeof t.id === 'string' && isThisWeekExcludingToday(t.due_date, today, weekRange))
    .sort(compareByDueDateThenPriority);
}

// B1.2 "진행중인 프로젝트 간단 현황(개수/진행률)". id 없는 레코드는 React key로 못 쓰므로 제외한다
// (electron/dataStore.js의 normalizeData는 배열/객체 여부만 보장, 필드 단위 검증은 없음).
function getInProgressProjects(projects, todos) {
  return projects
    .filter((p) => p && typeof p.id === 'string' && p.status === '진행중')
    .map((p) => ({ ...p, progress: calculateProjectProgress(p.id, todos) }));
}

export default function Dashboard() {
  const { apiAvailable, data, error } = useAppData();

  if (!apiAvailable) {
    return (
      <>
        <h1>대시보드</h1>
        <div className="empty-state-card">
          <p>window.api를 사용할 수 없습니다 (Electron 렌더러 밖에서 실행 중).</p>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <h1>대시보드</h1>
        <div className="empty-state-card">
          <p>데이터를 불러오지 못했습니다: {error}</p>
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <h1>대시보드</h1>
        <div className="empty-state-card">
          <p>불러오는 중...</p>
        </div>
      </>
    );
  }

  // 오늘/이번주 판정을 렌더 한 번에 한 번만 계산해 두 목록에 동일하게 적용한다(critical-reviewer
  // 지적: 각자 새로 계산하면 자정을 걸쳐 렌더될 때 "오늘"이 목록마다 달라질 수 있었음).
  const today = getTodayDateString();
  const weekRange = getThisWeekRange();
  const todayDueTodos = getTodayDueTodos(data.todos, today);
  const thisWeekDueTodos = getThisWeekDueTodos(data.todos, today, weekRange);
  const inProgressProjects = getInProgressProjects(data.projects, data.todos);
  const avgProgress = inProgressProjects.length
    ? Math.round(inProgressProjects.reduce((sum, p) => sum + p.progress, 0) / inProgressProjects.length)
    : 0;
  // P1.4: scheduleGrid.js(P5.1)가 이미 일회성/반복 전개를 다 처리하므로 오늘 날짜로 한 번
  // 호출하면 된다 — id 없는 레코드는 다른 목록들과 동일하게 제외한다. getSchedulesForDate는
  // 정렬하지 않고 data.json 저장 순서를 그대로 돌려준다 — 이 화면은 개수만 요약하는 목적이라
  // (일정 화면 상세와 달리) 정렬 기준을 따로 두지 않는 것으로 결정한다.
  const allTodaySchedules = getSchedulesForDate(data.schedules, today);
  const todaySchedules = allTodaySchedules.filter((s) => typeof s.id === 'string');
  const droppedScheduleCount = allTodaySchedules.length - todaySchedules.length;

  return (
    <>
      <h1>대시보드</h1>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">오늘 마감인 할일</h2>
          <span className="card-count-badge">{todayDueTodos.length}</span>
        </div>
        {todayDueTodos.length === 0 ? (
          <p className="empty-text">오늘 마감인 할일이 없습니다.</p>
        ) : (
          <ul className="card-list">
            {/* B2.2 패턴과 동일하게 완료된 항목도 숨기지 않고 취소선으로 남긴다(B1.2는 완료분 처리를 규정하지 않음). */}
            {todayDueTodos.map((t) => (
              <TodoRow key={t.id} todo={t} projects={data.projects} showProject />
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">이번주 마감인 할일</h2>
          <span className="card-count-badge">{thisWeekDueTodos.length}</span>
        </div>
        {thisWeekDueTodos.length === 0 ? (
          <p className="empty-text">이번주 마감인 할일이 없습니다.</p>
        ) : (
          <ul className="card-list">
            {thisWeekDueTodos.map((t) => (
              <TodoRow key={t.id} todo={t} projects={data.projects} showDate showProject />
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">진행중인 프로젝트 현황</h2>
          <span className="card-count-badge">{inProgressProjects.length}</span>
        </div>
        {inProgressProjects.length === 0 ? (
          <p className="empty-text">진행중인 프로젝트가 없습니다.</p>
        ) : (
          <>
            <p className="project-progress-summary">
              진행중 {inProgressProjects.length}개 · 평균 진행률 {avgProgress}%
            </p>
            <ul className="card-list">
              {inProgressProjects.map((p) => (
                <li key={p.id} className="project-row">
                  <div className="project-row-header">
                    <span>{p.name}</span>
                    <span className="percent">{p.progress}%</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: progressBarWidth(p.progress) }} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">오늘 일정</h2>
          <span className="card-count-badge">{todaySchedules.length}</span>
        </div>
        {droppedScheduleCount > 0 && (
          <p className="data-issue-notice">
            id 없는 일정 {droppedScheduleCount}개는 목록에 표시되지 않습니다 (data.json 확인 필요)
          </p>
        )}
        {todaySchedules.length === 0 ? (
          <p className="empty-text">오늘 일정이 없습니다.</p>
        ) : (
          <ul className="card-list">
            {todaySchedules.map((s) => (
              <li key={s.id} className="schedule-item-row">
                <div className="schedule-item-main">
                  <span className="schedule-item-title">{s.title}</span>
                  {isScheduleRecurring(s) && <span className="schedule-recurring-badge">반복</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
