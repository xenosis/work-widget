import { useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Dashboard from './screens/Dashboard.jsx';
import Projects from './screens/Projects.jsx';
import Todos from './screens/Todos.jsx';
import Memos from './screens/Memos.jsx';
import Schedule from './screens/Schedule.jsx';

// B1.3: 사이드바 메뉴 구성 — 대시보드 / 프로젝트 / 할일전체 / 메모 / 일정
const SCREENS = {
  dashboard: Dashboard,
  projects: Projects,
  todos: Todos,
  memos: Memos,
  schedule: Schedule,
};

export default function App() {
  const [screen, setScreen] = useState('dashboard');
  const Screen = SCREENS[screen];

  return (
    <div className="app">
      <Sidebar current={screen} onSelect={setScreen} />
      <main className="content">
        <Screen />
      </main>
    </div>
  );
}
