// B2.1 상세화면: 프로젝트에 소속된 할일 목록. project_id 매칭 자체는 projectProgress.js/
// projectStatus.js와 같지만, 이 함수는 화면에 렌더할 목록도 함께 돌려줘야 해서 id 없는
// 레코드를 추가로 제외한다(React key로 못 쓰므로 — Dashboard.jsx/Projects.jsx와 동일 방어).
// 그래서 이 목록의 개수는 projectProgress.js가 보는 전체 개수(분모)보다 적을 수 있다 —
// 상세화면이 "진행률 50%"인데 "할일 0개"로 보이는 모순을 막기 위해 droppedCount를 함께
// 반환해 Todos.jsx(P3.1)와 동일한 data-issue-notice를 띄울 수 있게 한다.
export function getTodosForProject(todos, projectId) {
  const all = (Array.isArray(todos) ? todos : []).filter((t) => t && t.project_id === projectId);
  const valid = all.filter((t) => typeof t.id === 'string');
  return { todos: valid, droppedCount: all.length - valid.length };
}
