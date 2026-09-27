// backlogSourceActions.js와 같은 이유로 화면 밖으로 뺀 순수 액션 팩토리 — "최신 data 위에
// 이 필드만 바꾼 새 전체 객체를 만든다"는 변환 로직만 담는다. 실제 동시 저장 직렬화(여러
// 소스가 각자 다른 시점에 저장을 시도할 수 있는 문제)는 WeeklyReport.jsx의 `enqueueSave`
// (프라미스 체인)가 이미 보장한 상태에서 이 함수들을 호출하므로, 여기서는 그 직렬화/최신성
// 자체를 신경 쓰지 않는다(순수 함수라 ref를 전혀 받지 않음 — Backlog.jsx의 handleRotateSnapshot
// 과 달리 이 모듈은 react-hooks/refs 제약과도 무관하다).
export function buildExampleSaveData(data, exampleText) {
  return { ...data, weekly_report_example: exampleText };
}

export function buildReportSaveData(data, sourceId, report) {
  const nextSources = data.backlog_sources.map((s) => (s && s.id === sourceId ? { ...s, weekly_report: report } : s));
  return { ...data, backlog_sources: nextSources };
}
