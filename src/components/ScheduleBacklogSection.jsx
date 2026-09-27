// P28: 등록된 backlog_sources 전부를 읽어 due_date 있는 task를 하나의 평평한 배열로 모아
// 부모(Schedule.jsx)에 보고하는 집계 컨테이너 — 화면에 아무것도 그리지 않고(각 소스를 실제로
// 읽는 ScheduleBacklogSourceSync 자식들만 마운트), Backlog.jsx의 changesBySource 집계 패턴과
// 같은 이유(여러 소스가 각자 다른 시점에 자기 몫만 보고하므로 sourceId 키로 관리 — 소스 하나가
// 삭제/갱신돼도 나머지는 안 흔들림)를 그대로 따른다.
import { useCallback, useEffect, useState } from 'react';
import { getUsableBacklogSources } from '../lib/backlogSourceMutations.js';
import ScheduleBacklogSourceSync from './ScheduleBacklogSourceSync.jsx';

export default function ScheduleBacklogSection({ sources, onItemsChange }) {
  const [itemsBySource, setItemsBySource] = useState({});

  const handleSourceItemsChange = useCallback((sourceId, items) => {
    setItemsBySource((prev) => {
      if (items === null) {
        if (!(sourceId in prev)) return prev;
        const next = { ...prev };
        delete next[sourceId];
        return next;
      }
      if (prev[sourceId] === items) return prev;
      return { ...prev, [sourceId]: items };
    });
  }, []);

  // 집계 결과를 부모에 알리는 부수효과는 렌더 중이 아니라 커밋 이후에 한다(setState를
  // 렌더 중에 직접 호출하지 않기 위함) — Backlog.jsx의 onDiffChange 보고 방식과 동일.
  useEffect(() => {
    onItemsChange(Object.values(itemsBySource).flat());
  }, [itemsBySource, onItemsChange]);

  const usableSources = getUsableBacklogSources(sources);
  return (
    <>
      {usableSources.map((s) => (
        <ScheduleBacklogSourceSync key={s.id} source={s} onItemsChange={handleSourceItemsChange} />
      ))}
    </>
  );
}
