// P1.7: 할일 행에 소속 프로젝트명을 표시하기 위한 조회. project_id가 없거나(전체 메모/할일)
// 가리키는 프로젝트가 삭제 등으로 사라졌으면(방어적으로) null을 반환해 호출부가 조용히 생략한다.
export function getProjectName(projects, projectId) {
  if (!projectId || !Array.isArray(projects)) return null;
  const project = projects.find((p) => p && p.id === projectId);
  return project && typeof project.name === 'string' ? project.name : null;
}

// P3.3: id가 없거나 문자열이 아닌 프로젝트 레코드를 골라내는 화면 대상. 프로젝트 목록/카드
// 화면(projectGrouping.js)은 이미 같은 기준으로 거르는데, 여기서 걸러지지 않은 레코드를 select
// 옵션으로 그대로 노출하면 화면마다 "프로젝트 모집단"이 달라지고, value 없는 <option>을 고르면
// 프로젝트명 문자열이 project_id로 그대로 저장돼 어느 화면에서도 연결되지 않는 고아 레코드가
// 생긴다(critical-reviewer 지적). id가 빈 문자열이면 "전체 메모/미선택"을 나타내는 select의
// value=""와 충돌해 잘못 고른 것처럼 동작하고, name이 없거나 빈 문자열이면 옵션 라벨이 빈
// 글자로 보여 "골랐는데 아무 일도 안 일어난 것처럼" 느껴진다 — 둘 다 실제로는 선택을 걸러야
// 하는 손상 레코드라 함께 거른다(P4.4 리뷰에서 지적).
export function getUsableProjects(projects) {
  return (Array.isArray(projects) ? projects : []).filter(
    (p) => p && typeof p.id === 'string' && p.id !== '' && typeof p.name === 'string' && p.name.trim() !== ''
  );
}

// P4.4: project_id가 채워져 있지만(=null이 아니라 "지정된 상태") 가리키는 프로젝트가
// usableProjects 목록에 없는 경우 — 소속 프로젝트가 삭제된 고아 참조(P2.8 미결 정책)인지
// 판정한다. select가 "전체 메모"와 "고아 상태"를 같은 value("")로 표시하면 이미 ""가 선택된
// 상태에서 "전체 메모"를 다시 골라도 change 이벤트가 안 떠 해제가 안 되는 버그가 생긴다
// (critical-reviewer [High] 지적) — 그래서 화면이 고아 상태를 구분해 별도 옵션으로 보여줘야
// 한다.
export function isOrphanProjectRef(projects, projectId) {
  if (!projectId) return false;
  return !getUsableProjects(projects).some((p) => p.id === projectId);
}
