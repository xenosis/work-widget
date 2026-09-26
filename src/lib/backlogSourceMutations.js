// scheduleCategoryMutations.js와 같은 이유로 화면(Schedule.jsx) 밖으로 뺀 순수 함수들.

// id/path 없는 레코드(수기 편집된 data.json 등)를 걸러낸다 — getUsableCategories와 같은 패턴.
export function getUsableBacklogSources(sources) {
  return sources.filter((s) => s && s.id && typeof s.path === 'string' && s.path);
}

export function removeBacklogSource(sources, sourceId) {
  return sources.filter((s) => !(s && s.id === sourceId));
}

// path에서 사람이 알아보기 쉬운 이름을 유도한다 — 파일명 자체는 대개 "backlog.json"으로
// 다 똑같으므로, 파일이 들어있는 폴더 이름(대개 프로젝트 폴더)을 쓴다. 윈도우(\)/POSIX(/)
// 구분자를 둘 다 받아들인다.
export function deriveLabelFromPath(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) return '(알 수 없는 소스)';
  const segments = filePath.split(/[\\/]/).filter(Boolean);
  if (segments.length === 0) return '(알 수 없는 소스)';
  if (segments.length === 1) return segments[0];
  return segments[segments.length - 2];
}

// label을 사용자가 직접 지정하는 UI는 없지만(backlogSourceFactory.js 참고), 스키마 자체는
// 나중에 지정 UI가 생겨도 바로 쓸 수 있게 label 필드를 이미 갖고 있다 — 있으면 그걸, 없으면
// path에서 유도한 이름을 표시한다.
export function getSourceDisplayLabel(source) {
  if (source && typeof source.label === 'string' && source.label.trim()) return source.label.trim();
  return deriveLabelFromPath(source && source.path);
}
