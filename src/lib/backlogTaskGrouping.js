// P14.2: 등록된 외부 backlog(.json) 소스가 돌려준 task 목록(electron/backlogSourceReader.js의
// parseBacklogSourceTasks가 만든 { id, title, status, owner } 형태)을 화면에 "상태/담당자
// 기준으로 나열"(사람 결정)하기 위한 순수 함수. status 값 자체가 프로젝트마다 자유 문자열이라
// (이 프로젝트처럼 정해진 enum이 아님) 고정된 상태 목록을 가정하지 않고, task 배열에 등장한
// 순서 그대로 그룹을 만든다 — 그래야 이 프로젝트가 모르는 상태값(예: 다른 프로젝트의
// "블록됨")도 조용히 묶여서 나온다. status×owner 이중 그룹(상태 안에 담당자 하위 그룹을 또
// 만드는 것)까지는 하지 않는다 — 상태만으로도 이미 프로젝트마다 값이 제각각이라 그룹이 너무
// 잘게 쪼개질 수 있어서다. 대신 critical-reviewer 지적(P14.2 리뷰, High — "담당자 기준"이
// 구조에 전혀 반영되지 않았다는 지적): 각 상태 그룹 "안에서" 담당자로 안정 정렬해, 같은
// 담당자의 task가 시각적으로 모이게 한다(담당자 없는 task는 뒤로). Array.prototype.sort는
// ECMAScript 2019+ 명세상 stable이라 같은 담당자끼리는 원래(배열 등장) 순서를 유지한다.
function sortByOwner(tasks) {
  return [...tasks].sort((a, b) => {
    if (a.owner === b.owner) return 0;
    if (a.owner === null) return 1;
    if (b.owner === null) return -1;
    return a.owner < b.owner ? -1 : 1;
  });
}

export function groupTasksByStatus(tasks) {
  const order = [];
  const byStatus = new Map();
  for (const task of tasks) {
    if (!byStatus.has(task.status)) {
      byStatus.set(task.status, []);
      order.push(task.status);
    }
    byStatus.get(task.status).push(task);
  }
  return order.map((status) => ({ status, tasks: sortByOwner(byStatus.get(status)) }));
}

// P24(사용자 발견, 2026-09-27): 이 프로젝트 자신의 backlog(.json, 105개)로 실제 확인해보니
// 상태 그룹당 cap(호출부의 MAX_TASKS_PER_GROUP, P14.2에서 대용량 외부 파일 DOM 폭증 방지용)에
// 걸려 "외 N개"로 잘리는데, 이번 주 바뀐 항목(changedIds — Set이든 Map이든 .has(id)만 있으면
// 되므로, 호출부가 상태 변경 전 값까지 같이 들고 있고 싶으면 Map을 넘겨도 된다)이 하필 잘린
// 쪽에 있으면 색으로 구분해도 안 보여 의미가 없다는 지적 — 바뀐 항목은 cap에서 예외로 두고 항상 포함시키고,
// 안 바뀐 나머지만 cap을 적용한다. 원래 배열 순서(등장 순서)는 그대로 유지한다(바뀐 항목이라고
// 목록 맨 앞으로 끌어올리지 않음 — 색으로 이미 구분되므로 순서까지 바꾸면 오히려 "이 파일의
// 원래 순서"라는 다른 정보를 잃는다).
// critical-reviewer 지적(High): 처음엔 "안 바뀐 것 중 cap개의 id"를 Set으로 만들어 그 Set에
// 속하는지로 다시 필터링했는데, 외부 파일은 id 중복이 없다는 보장이 없어(이 프로젝트가
// 통제할 수 없는 데이터 — B3.5의 읽기 전용 원칙과 같은 이유로 형식을 강제하지 못함) 같은
// id가 여러 번 나오면 Set이 중복을 하나로 뭉개버려 cap이 새거나(같은 id 행이 cap보다 많이
// 나옴) hiddenCount가 부풀려지는 버그가 있었다. id로 "속하는지"를 다시 물어보는 대신, tasks를
// 한 번만 순회하며 그 자리에서 바로 "보여줄지"를 정하는 방식으로 바꿔 중복 id에도 안전하게
// 만든다(각 행은 정확히 자기 자신의 위치만으로 판단되고, 다른 행과 id가 같다고 서로 영향을
// 주지 않는다).
export function selectGroupDisplayTasks(tasks, changedIds, cap) {
  const displayed = [];
  let unchangedTotal = 0;
  let unchangedShown = 0;
  for (const t of tasks) {
    if (changedIds.has(t.id)) {
      displayed.push(t);
      continue;
    }
    unchangedTotal += 1;
    if (unchangedShown < cap) {
      displayed.push(t);
      unchangedShown += 1;
    }
  }
  return { displayed, hiddenCount: unchangedTotal - unchangedShown };
}
