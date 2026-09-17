// B1.2: 초기 진입 화면 — 오늘의 할일 요약 대시보드
// P1.5: window.api.loadData()로 실제 data.json을 불러온다. 오늘 일정(캘린더 이벤트)은 P1.4에서
// 이어서 채운다.
import { calculateProjectProgress } from '../lib/projectProgress.js';
import { getTodayDateString, isThisWeekExcludingToday } from '../lib/dateRange.js';
import { useAppData } from '../lib/useAppData.js';
import { priorityRank, compareByDueDateThenPriority, priorityClassName } from '../lib/priority.js';
import { ScheduleIcon } from '../components/icons.jsx';

// B4.2: 마감일이 같으면 우선순위(상→중→하) 순. id 없는 레코드는 React key로 못 쓰므로 제외한다
// (electron/dataStore.js의 normalizeData는 배열/객체 여부만 보장하고 필드 단위 검증은 하지 않음).
function getTodayDueTodos(todos) {
  const today = getTodayDateString();
  return todos
    .filter((t) => typeof t.id === 'string' && t.due_date === today)
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
}

// B1.2 "이번주 마감인 할일 목록" — 오늘은 제외(P1.1이 별도로 다룸), 그 외 이번주(월~일,
// src/lib/dateRange.js) 범위는 이미 지난 날짜(예: 오늘이 수요일이면 월/화 마감)도 포함한다.
// B4.1이 "마감 임박 할일은 대시보드에서 확인하는 방식으로 충분"이라고 대시보드를 유일한 확인
// 경로로 규정해서, 이미 지났다고 빼면 그 할일을 확인할 방법이 없어진다. 판정/정렬 모두
// src/lib(dateRange.js/priority.js)의 공유 함수를 쓴다 — Todos.jsx(P3.1)와 같은 정의를
// 유지하기 위함(각자 조건식을 복붙하면 한쪽만 고쳤을 때 조용히 갈라진다).
function getThisWeekDueTodos(todos) {
  return todos
    .filter((t) => typeof t.id === 'string' && isThisWeekExcludingToday(t.due_date))
    .sort(compareByDueDateThenPriority);
}

// B1.2 "진행중인 프로젝트 간단 현황(개수/진행률)". id 없는 레코드는 React key로 못 쓰므로 제외한다
// (electron/dataStore.js의 normalizeData는 배열/객체 여부만 보장, 필드 단위 검증은 없음).
function getInProgressProjects(projects, todos) {
  return projects
    .filter((p) => typeof p.id === 'string' && p.status === '진행중')
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

  const todayDueTodos = getTodayDueTodos(data.todos);
  const thisWeekDueTodos = getThisWeekDueTodos(data.todos);
  const inProgressProjects = getInProgressProjects(data.projects, data.todos);
  const avgProgress = inProgressProjects.length
    ? Math.round(inProgressProjects.reduce((sum, p) => sum + p.progress, 0) / inProgressProjects.length)
    : 0;

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
            {todayDueTodos.map((t) => (
              // B2.2 패턴과 동일하게 완료된 항목도 숨기지 않고 취소선으로 남긴다(B1.2는 완료분 처리를 규정하지 않음).
              <li key={t.id} className="todo-row">
                <span className={`todo-dot ${priorityClassName(t.priority)}`} />
                <span className={`todo-title ${t.completed ? 'completed' : ''}`}>{t.title}</span>
                {t.priority && (
                  <span className={`priority-chip ${priorityClassName(t.priority)}`}>{t.priority}</span>
                )}
              </li>
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
              <li key={t.id} className="todo-row">
                <span className={`todo-dot ${priorityClassName(t.priority)}`} />
                <span className={`todo-title ${t.completed ? 'completed' : ''}`}>{t.title}</span>
                <span className="todo-due-date">{t.due_date}</span>
                {t.priority && (
                  <span className={`priority-chip ${priorityClassName(t.priority)}`}>{t.priority}</span>
                )}
              </li>
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
                    <div className="progress-fill" style={{ width: `${p.progress}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="info-card">
        <ScheduleIcon />
        <span>일정 총 {data.schedules.length}개</span>
      </div>
    </>
  );
}
