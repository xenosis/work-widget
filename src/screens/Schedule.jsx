// B2.4: 월간/주간 탭 전환, 반복 일정(루틴) 표시
import { ScheduleIcon } from '../components/icons.jsx';

export default function Schedule() {
  return (
    <>
      <h1>일정</h1>
      <div className="empty-state-card">
        <ScheduleIcon />
        <p>월간/주간 탭 (구현 예정)</p>
      </div>
    </>
  );
}
