// P17: 외부 backlog(.json) 소스의 task 목록(electron/backlogSourceReader.js가 만든
// { id, title, status, owner } 형태)을 "캘린더 주(월~일) 기준 변화"로 보여주기 위한 순수
// 함수들. dateRange.js의 getThisWeekRange()가 이미 "이번 주 월요일" 계산을 공유하고 있어
// 그대로 재사용한다(주 시작 요일 해석이 이 위젯 전체에서 갈라지지 않도록).
//
// 기준선(baseline) 개념: 이번 주 들어 그 소스를 처음 확인한 시점의 상태를 "이번 주 기준선"으로
// 저장해 두고, 그 이후 확인할 때마다 지금 상태와 그 기준선을 비교해 "이번 주 동안 뭐가
// 바뀌었는지"를 보여준다. 한계(critical-reviewer 지적, Medium — 최초 서술이 정확도를
// 과장했었다: work-widget-requirements.md B3.5 참고): 매주 최소 한 번씩 확인하더라도
// 정확하지 않다 — 기준선은 "그 주 첫 확인 시점"의 스냅샷일 뿐이라, 지난 주 마지막 확인과
// 이번 주 첫 확인 사이에 생긴 변화는 어느 주의 diff에도 안 나타나고 영구히 빠진다. 실제
// "지난 월요일" 상태를 소급 재구성할 방법도 없다.
import { getThisWeekRange, formatLocalDate } from './dateRange.js';

function addDays(dateString, days) {
  const [y, m, d] = dateString.split('-').map(Number);
  return formatLocalDate(new Date(y, m - 1, d + days));
}

// snapshot이 없거나 지난 주 기준이면 지금 상태를 이번 주의 새 기준선으로 삼는다. 이미 이번
// 주 기준선이면 참조를 그대로 돌려준다(호출부가 "새 기준선이 필요한지"를 참조 비교만으로
// 판단할 수 있게 하기 위함 — 매 렌더마다 새 객체를 만들면 불필요한 재저장이 반복된다).
export function resolveWeeklySnapshot(snapshot, currentTasks) {
  const { weekStart } = getThisWeekRange();
  if (snapshot && snapshot.weekStart === weekStart) return snapshot;
  // P18(주 시작 요일 월요일→일요일 전환) 호환(critical-reviewer 지적, High): 이 전환 이전에
  // 저장된 기준선은 "그 주의 월요일" 날짜를 weekStart로 갖고 있다 — 월요일은 항상 새 규칙의
  // weekStart(일요일) 바로 다음 날이므로, 저장된 값이 그 패턴과 일치하면 기준선을 강제로
  // 리셋(=지금 상태를 새 기준선으로)하지 않고 같은 task 스냅샷을 이어받되 weekStart 표기만
  // 새 규칙으로 고쳐 쓴다. 이렇게 안 하면 이 전환이 배포된 첫 주에는 실제로 아무 task도 안
  // 바뀌었어도 "이번 주 변경 사항"이 강제로 리셋돼 사라진다.
  if (snapshot && snapshot.weekStart === addDays(weekStart, 1)) {
    return { weekStart, tasks: snapshot.tasks };
  }
  return { weekStart, tasks: currentTasks };
}

// 기준선(snapshot.tasks)과 현재 tasks를 id로 비교해 이번 주 동안의 변화를 뽑는다. id가
// 새로 보이면 added, 기준선에는 있었는데 지금 없으면 removed(완료 후 지워졌을 수도, 원본
// 파일에서 삭제됐을 수도 — 구분하지 않음), 같은 id인데 status가 다르면 statusChanged.
export function diffWeeklyChanges(snapshot, currentTasks) {
  const baselineTasks = (snapshot && snapshot.tasks) || [];
  const baselineById = new Map(baselineTasks.map((t) => [t.id, t]));
  const currentIds = new Set(currentTasks.map((t) => t.id));

  const added = [];
  const statusChanged = [];
  for (const task of currentTasks) {
    const before = baselineById.get(task.id);
    if (!before) {
      added.push(task);
    } else if (before.status !== task.status) {
      statusChanged.push({ ...task, previousStatus: before.status });
    }
  }
  const removed = baselineTasks.filter((t) => !currentIds.has(t.id));

  return { added, removed, statusChanged };
}

// 화면 요약 줄("todo 3 · done 5 · in_review 1")용 — 상태별 개수만 필요하므로 groupTasksByStatus
// 전체를 다시 쓰기보다 가벼운 카운트만 뽑는 전용 함수를 둔다.
export function countTasksByStatus(tasks) {
  const order = [];
  const counts = new Map();
  for (const task of tasks) {
    if (!counts.has(task.status)) {
      counts.set(task.status, 0);
      order.push(task.status);
    }
    counts.set(task.status, counts.get(task.status) + 1);
  }
  return order.map((status) => ({ status, count: counts.get(status) }));
}
