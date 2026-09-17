// B2.2: 오늘/이번주/나중 날짜 그룹핑, 완료해도 취소선으로 유지
// P3.1: 프로젝트 구분과 무관하게 날짜 기준으로만 그룹핑. 할일 추가(B2.2 "이 화면에서도 새 할일
// 추가 가능")는 범위 밖 — 아직 IPC 쓰기 경로(P2.5/P3.x CRUD)가 없어 읽기 전용으로만 구현.
import { groupTodosByDate } from '../lib/todoGrouping.js';
import { useAppData } from '../lib/useAppData.js';
import { priorityClassName } from '../lib/priority.js';

function TodoGroup({ title, todos, emptyText, showDate }) {
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">{title}</h2>
        <span className="card-count-badge">{todos.length}</span>
      </div>
      {todos.length === 0 ? (
        <p className="empty-text">{emptyText}</p>
      ) : (
        <ul className="card-list">
          {todos.map((t) => (
            // B2.2: 완료해도 목록에서 사라지지 않고 취소선으로 남는다.
            <li key={t.id} className="todo-row">
              <span className={`todo-dot ${priorityClassName(t.priority)}`} />
              <span className={`todo-title ${t.completed ? 'completed' : ''}`}>{t.title}</span>
              {showDate && t.due_date && <span className="todo-due-date">{t.due_date}</span>}
              {t.priority && (
                <span className={`priority-chip ${priorityClassName(t.priority)}`}>{t.priority}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Todos() {
  const { apiAvailable, data, error } = useAppData();

  if (!apiAvailable) {
    return (
      <>
        <h1>할일전체</h1>
        <div className="empty-state-card">
          <p>window.api를 사용할 수 없습니다 (Electron 렌더러 밖에서 실행 중).</p>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <h1>할일전체</h1>
        <div className="empty-state-card">
          <p>데이터를 불러오지 못했습니다: {error}</p>
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <h1>할일전체</h1>
        <div className="empty-state-card">
          <p>불러오는 중...</p>
        </div>
      </>
    );
  }

  const { today, week, later, droppedCount } = groupTodosByDate(data.todos);

  return (
    <>
      <h1>할일전체</h1>
      {droppedCount > 0 && (
        <p className="data-issue-notice">
          id 없는 할일 {droppedCount}개는 목록에 표시되지 않습니다 (data.json 확인 필요)
        </p>
      )}
      <TodoGroup title="오늘" todos={today} emptyText="오늘 마감인 할일이 없습니다." showDate={false} />
      <TodoGroup title="이번주" todos={week} emptyText="이번주 마감인 할일이 없습니다." showDate />
      <TodoGroup
        title="나중 (지난 마감 포함)"
        todos={later}
        emptyText="나중 할일이 없습니다."
        showDate
      />
    </>
  );
}
