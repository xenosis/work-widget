// scheduleCategoryActions.js와 같은 이유로 화면 밖으로 뺀 액션 팩토리(max-lines 여유 확보).
// 이름에 "use" 접두어를 안 붙인 이유도 동일(react-hooks/rules-of-hooks 오인 방지). (P15에서
// 호출부가 Schedule.jsx에서 설정 탭 src/screens/Settings.jsx로 옮겨졌다.)
import { createBacklogSource } from './backlogSourceFactory.js';
import { removeBacklogSource } from './backlogSourceMutations.js';

export function createBacklogSourceActions({ data, setData, saving, setSaving }) {
  // 같은 경로를 중복 등록하면 현황판(P14.2)에 같은 소스가 두 번 나열되는 혼란만 생기고
  // 얻는 것이 없다 — 이미 등록된 path면 조용히 무시한다(에러를 던지지 않음, 파일 선택
  // 다이얼로그에서 실수로 같은 파일을 두 번 고르는 흔한 경우를 매끄럽게 넘기기 위함).
  async function handleAddSource(path) {
    if (saving) throw new Error('저장이 진행 중입니다. 잠시 후 다시 시도하세요.');
    if (typeof path !== 'string' || !path) return;
    if (data.backlog_sources.some((s) => s && s.path === path)) return;
    setSaving(true);
    try {
      const nextSources = [...data.backlog_sources, createBacklogSource({ path })];
      const newData = { ...data, backlog_sources: nextSources };
      await window.api.saveData(newData);
      setData(newData);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSource(sourceId) {
    if (saving) throw new Error('저장이 진행 중입니다. 잠시 후 다시 시도하세요.');
    setSaving(true);
    try {
      const nextSources = removeBacklogSource(data.backlog_sources, sourceId);
      const newData = { ...data, backlog_sources: nextSources };
      await window.api.saveData(newData);
      setData(newData);
    } finally {
      setSaving(false);
    }
  }

  return { handleAddSource, handleDeleteSource };
}
