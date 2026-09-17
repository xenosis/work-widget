import { DashboardIcon, ProjectIcon, TodoIcon, MemoIcon, ScheduleIcon } from './icons.jsx';

const MENU = [
  { key: 'dashboard', label: '대시보드', Icon: DashboardIcon },
  { key: 'projects', label: '프로젝트', Icon: ProjectIcon },
  { key: 'todos', label: '할일전체', Icon: TodoIcon },
  { key: 'memos', label: '메모', Icon: MemoIcon },
  { key: 'schedule', label: '일정', Icon: ScheduleIcon },
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
