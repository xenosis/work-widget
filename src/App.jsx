import { useState } from 'react';
import TitleBar from './components/TitleBar.jsx';
import Sidebar from './components/Sidebar.jsx';
import Dashboard from './screens/Dashboard.jsx';
import Projects from './screens/Projects.jsx';
import Todos from './screens/Todos.jsx';
import Memos from './screens/Memos.jsx';
import Schedule from './screens/Schedule.jsx';
import Backlog from './screens/Backlog.jsx';
import WeeklyReport from './screens/WeeklyReport.jsx';
import Settings from './screens/Settings.jsx';

// B1.3: 사이드바 메뉴 구성 — 대시보드 / 프로젝트 / 할일전체 / 메모 / 일정 / 백로그(P19 추가) /
// 주간보고(P26 추가) / 설정(P15 추가)
const SCREENS = {
  dashboard: Dashboard,
  projects: Projects,
  todos: Todos,
  memos: Memos,
  schedule: Schedule,
  backlog: Backlog,
  weeklyReport: WeeklyReport,
  settings: Settings,
};

export default function App() {
  const [screen, setScreen] = useState('dashboard');
  const Screen = SCREENS[screen];

  return (
    <div className="app-shell">
      <TitleBar />
      <div className="app">
        <Sidebar current={screen} onSelect={setScreen} />
        <main className="content">
          <Screen />
        </main>
      </div>
    </div>
  );
}
