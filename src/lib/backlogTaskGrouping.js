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
