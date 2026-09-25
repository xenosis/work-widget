import { deriveProjectStatus } from './projectStatus.js';

// P2.5 리뷰(critical-reviewer): 수정/삭제 변환 로직이 Projects.jsx 화면 파일 안에 인라인으로만
// 있어 vitest 대상 밖이었다(생성만 projectFactory.js로 분리돼 있었음). 화면은 이 순수 함수를
// 호출해 다음 projects 배열을 만들고 window.api.saveData로 저장하는 책임만 진다.

// B4.3: status는 폼이 고른 값을 그대로 쓰지 않고 deriveProjectStatus를 한 번 거친다 — 그래야
// "완료"를 수동으로 골라도 소속 todo가 전부 완료가 아니면 자동으로 "진행중"으로 되돌아간다
// (handleAddTodo가 이미 쓰는 것과 동일한 규칙).
export function applyProjectUpdate(projects, projectId, updates, todos, now = new Date().toISOString()) {
  return projects.map((p) =>
    p && p.id === projectId
      ? {
          ...p,
          ...updates,
          status: deriveProjectStatus(updates.status, projectId, todos),
          updated_at: now,
        }
      : p
  );
}

// P2.8 결정(사람, 2026-09-24): 프로젝트 삭제는 소속 todo/memo를 고아로 남기지 않고 함께
// 지운다(cascade). 화면(P2.10)이 삭제 확인 단계에서 무엇이 지워지는지 먼저 보여준 뒤에만
// 이 함수를 호출한다. applyProjectUpdate와 마찬가지로 호출자(useAppData가 준 배열)가 이미
// 배열이라고 신뢰하고 방어 코드를 두지 않는다 — critical-reviewer 지적: 비배열 입력을 조용히
// []로 되돌리면(이전 구현) saveData로 그대로 흘러가 todos/memos 전체가 삭제되는 쪽이 예외를
// 던지는 쪽보다 훨씬 위험하다.
export function removeProjectCascade(projects, todos, memos, projectId) {
  return {
    projects: projects.filter((p) => !(p && p.id === projectId)),
    todos: todos.filter((t) => !(t && t.project_id === projectId)),
    memos: memos.filter((m) => !(m && m.project_id === projectId)),
  };
}
