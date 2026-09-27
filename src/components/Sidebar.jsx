import {
  DashboardIcon,
  ProjectIcon,
  TodoIcon,
  MemoIcon,
  ScheduleIcon,
  BacklogIcon,
  WeeklyReportIcon,
  SettingsIcon,
} from './icons.jsx';

// P15 결정(사람, 2026-09-26): 이전까지는 사이드바 메뉴를 5개로 고정해 두고(카테고리 관리 등
// 자주 안 쓰는 기능은 관련 화면 안에 접어두는 방침) 6번째를 안 늘렸는데, 실사용해보니 그
// 관리 UI들이 일정 화면 위쪽을 가려 캘린더가 바로 안 보이는 게 더 불편하다는 피드백을 받아
// "설정" 메뉴를 새로 추가하기로 결정을 뒤집었다(work-widget-requirements.md B1.3 참고).
// P19 결정(사람, 2026-09-26): "외부 백로그 현황"이 일정 탭에 얹혀 있을 이유가 없다는 피드백을
// 받아 7번째 메뉴로 분리한다 — 탭 개수가 느는 것보다, 캘린더와 무관한 정보를 억지로 일정
// 화면에 끼워 넣는 쪽이 더 큰 문제라고 판단했다(B1.3 참고).
const MENU = [
  { key: 'dashboard', label: '대시보드', Icon: DashboardIcon },
  { key: 'projects', label: '프로젝트', Icon: ProjectIcon },
  { key: 'todos', label: '할일전체', Icon: TodoIcon },
  { key: 'memos', label: '메모', Icon: MemoIcon },
  { key: 'schedule', label: '일정', Icon: ScheduleIcon },
  { key: 'backlog', label: '백로그', Icon: BacklogIcon },
  // P26: 백로그 기반 codex 자동 주간보고 — 8번째 메뉴로 분리(다른 탭들과 같은 이유, B1.3 참고).
  { key: 'weeklyReport', label: '주간보고', Icon: WeeklyReportIcon },
  { key: 'settings', label: '설정', Icon: SettingsIcon },
];

export default function Sidebar({ current, onSelect }) {
  return (
    <nav className="sidebar">
      {MENU.map(({ key, label, Icon }) => (
        <button
          key={key}
          className={key === current ? 'active' : ''}
          onClick={() => onSelect(key)}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
