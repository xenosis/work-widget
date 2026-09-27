// P19(사람 결정, 2026-09-26): "외부 백로그 현황"이 일정 탭에 얹혀 있던 걸 전용 사이드바 탭으로
// 분리한다 — 캘린더와 무관한 정보를 캘린더 화면에 억지로 끼워 넣었던 것이 문제였고, 백로그가
// 늘어날수록 한 화면에 전부 펼쳐두는 방식(BacklogStatusPanel.jsx, P14.2~P17)도 scale이 안
// 됐다. 이 화면은 (1) 모든 소스를 합친 "이번 주 전체 변경 사항"(BacklogWeeklyOverview.jsx)을
// 맨 위에, (2) 소스별 요약 행(BacklogSourceCard.jsx — 총 개수 + 변경 배지, 기본은 접힘)을 그
// 아래 둔다. 사용자의 최종 목표(백로그 기반 주간보고를 codex로 자동 작성)를 염두에 두고, (1)이
// 그 입력에 가장 가까운 형태가 되도록 한다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppData } from '../lib/useAppData.js';
import { BacklogIcon } from '../components/icons.jsx';
import { getUsableBacklogSources } from '../lib/backlogSourceMutations.js';
import BacklogWeeklyOverview from '../components/BacklogWeeklyOverview.jsx';
import BacklogSourceCard from '../components/BacklogSourceCard.jsx';

export default function Backlog() {
  const { apiAvailable, data, error, setData } = useAppData();
  // Schedule.jsx와 같은 이유(P5.4/P17 — savingRef로 동시 저장을 막고, dataRef로 대기하던
  // 저장이 자기 생성 시점의 오래된 data를 쓰지 않게 한다). 이 화면은 handleRotateSnapshot
  // 하나만 저장하므로 saving state로 폼을 막을 필요는 없다(배경 저장 전용이라 UI 비활성화가
  // 필요 없음 — BacklogSourceCard.jsx의 요약 행은 항상 클릭 가능해야 한다).
  const savingRef = useRef(false);
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const [changesBySource, setChangesBySource] = useState({});
  // useCallback 없이 넘기면 렌더마다 새 함수가 되어, 이 함수가 바뀔 때마다 모든
  // BacklogSourceCard.jsx의 "부모에 보고" effect가 다시 불린다(값 자체는 그대로라 setState가
  // 같은 참조를 돌려줘 리렌더는 막히지만, 불필요한 effect 재실행 자체는 남는다) — 참조를
  // 고정해 애초에 그 재실행이 안 생기게 한다.
  const handleDiffChange = useCallback((sourceId, diff) => {
    setChangesBySource((prev) => {
      if (prev[sourceId] === diff) return prev;
      if (diff === null) {
        if (!(sourceId in prev)) return prev;
        const next = { ...prev };
        delete next[sourceId];
        return next;
      }
      return { ...prev, [sourceId]: diff };
    });
  }, []);

  // critical-reviewer 지적(P19 리뷰, High): 이 함수를 그냥 평범한 함수로 두면(Schedule.jsx의
  // handleRotateSnapshot과 같은 이유로 처음엔 그렇게 했었다) 렌더마다 새 참조가 되어, 이 화면이
  // 다른 이유로(예: 다른 소스의 diff 보고) 재렌더될 때마다 모든 BacklogSourceCard.jsx의 기준선
  // 회전 effect가 다시 불린다 — 이미 저장을 시도한 주(attemptedWeekStartRef)라면 조기 반환되어
  // 실제 재저장까지는 안 가지만, 저장이 아직 끝나지 않은 채로 다시 불리면 그 진행 중이던
  // promise가 cancelled 처리되며 저장이 계속 다시 시작되는 낭비가 생긴다(Schedule.jsx는 이
  // 함수가 render 중 ref를 다른 함수에 "넘기지" 않고 자기 몸 안에서만 읽어서 react-hooks/refs를
  // 피했던 것이지, useCallback 자체가 금지된 게 아니다 — 이 함수는 ref를 직접 읽기만 하고
  // 어디에도 넘기지 않으므로 빈 의존 배열로 감싸도 그 규칙과 무관하다). setData는 useState가
  // 주는 안정적인 참조라(useAppData.js) 실제로 바뀔 일은 없지만, eslint가 커스텀 훅을 거친
  // 값까지는 그 안정성을 추론하지 못해 의존 배열에 그대로 넣어 둔다(안정적이므로 넣어도 이
  // 함수의 참조가 바뀌는 일은 없다).
  const handleRotateSnapshot = useCallback(async (sourceId, snapshot) => {
    if (savingRef.current) return false;
    savingRef.current = true;
    try {
      const nextSources = dataRef.current.backlog_sources.map((s) =>
        s && s.id === sourceId ? { ...s, weekly_snapshot: snapshot } : s
      );
      const newData = { ...dataRef.current, backlog_sources: nextSources };
      await window.api.saveData(newData);
      dataRef.current = newData;
      setData(newData);
    } catch (err) {
      console.error('주간 기준선 저장 실패:', err);
    } finally {
      savingRef.current = false;
    }
    return true;
  }, [setData]);

  if (!apiAvailable) {
    return (
      <>
        <h1>백로그</h1>
        <div className="empty-state-card">
          <p>window.api를 사용할 수 없습니다 (Electron 렌더러 밖에서 실행 중).</p>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <h1>백로그</h1>
        <div className="empty-state-card">
          <p>데이터를 불러오지 못했습니다: {error}</p>
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <h1>백로그</h1>
        <div className="empty-state-card">
          <BacklogIcon />
          <p>불러오는 중...</p>
        </div>
      </>
    );
  }

  const usableSources = getUsableBacklogSources(data.backlog_sources);

  return (
    <>
      <h1>백로그</h1>
      <BacklogWeeklyOverview changesBySource={changesBySource} sourceOrder={usableSources.map((s) => s.id)} />
      {usableSources.length === 0 ? (
        <p className="empty-text" title="등록된 외부 backlog(.json) 소스가 없습니다(설정 탭에서 먼저 등록하세요).">
          등록된 외부 backlog(.json) 소스가 없습니다(설정 탭에서 먼저 등록하세요).
        </p>
      ) : (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">등록된 백로그</h2>
            <span className="card-count-badge">{usableSources.length}</span>
          </div>
          {usableSources.map((s) => (
            <BacklogSourceCard
              key={s.id}
              source={s}
              onRotateSnapshot={handleRotateSnapshot}
              onDiffChange={handleDiffChange}
            />
          ))}
        </div>
      )}
    </>
  );
}
