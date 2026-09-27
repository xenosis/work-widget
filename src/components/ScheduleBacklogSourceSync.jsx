// P28: 등록된 backlog(.json) 소스 하나를 읽어 due_date 있는 task만 걸러 부모(ScheduleBacklogSection)
// 에 콜백으로 보고하는 로직 전용 컴포넌트 — 화면에 아무것도 그리지 않는다(null 반환). 여러
// 소스를 동적 개수만큼 동시에 읽어야 하는데 React 훅은 반복문 안에서 부를 수 없어서
// (BacklogSourceCard.jsx/WeeklyReportSourceRow.jsx와 같은 이유), 소스 배열을 map으로 돌리는
// 목록의 한 항목으로 이 컴포넌트를 둔다. 이 화면은 기준선을 저장하지 않는다(그건 백로그 탭의
// 역할, B3.5) — "지금 읽으면 이렇게 나온다"만 부모에 보고한다.
import { useEffect } from 'react';
import { getSourceDisplayLabel } from '../lib/backlogSourceMutations.js';
import { useBacklogSourceRead } from '../lib/useBacklogSourceRead.js';
import { getThisWeekRange } from '../lib/dateRange.js';
import { filterTasksWithDueDate } from '../lib/scheduleGrid.js';

export default function ScheduleBacklogSourceSync({ source, onItemsChange }) {
  const state = useBacklogSourceRead(source.path, getThisWeekRange().weekStart);
  const label = getSourceDisplayLabel(source);
  const canRead = state.ok && state.recognized;

  useEffect(() => {
    if (!canRead) {
      onItemsChange(source.id, null);
      return undefined;
    }
    const items = filterTasksWithDueDate(state.tasks, source.id, label);
    onItemsChange(source.id, items.length > 0 ? items : null);
    // 소스가 삭제되거나(부모가 이 컴포넌트를 언마운트) 이 소스가 더 이상 읽을 수 없게 되면
    // 통합 목록에서도 이 소스의 항목을 지운다(BacklogSourceCard.jsx의 onDiffChange와 동일 패턴).
    return () => onItemsChange(source.id, null);
  }, [source.id, label, canRead, state.tasks, onItemsChange]);

  return null;
}
