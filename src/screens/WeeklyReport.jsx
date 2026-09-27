// P26: 백로그 기반 주간보고를 codex(P25 백엔드)로 자동 생성하는 화면. 예시 문장(전역, 모든
// 소스 공통 — 회사 실제 예시는 아직 없어 사람이 나중에 채운다는 전제, P25 요구사항 문서 참고)을
// 입력/저장하고, 등록된 소스마다 WeeklyReportSourceRow가 생성 버튼/결과를 보여준다.
import { useEffect, useRef, useState } from 'react';
import { useAppData } from '../lib/useAppData.js';
import { WeeklyReportIcon } from '../components/icons.jsx';
import { getUsableBacklogSources } from '../lib/backlogSourceMutations.js';
import { buildExampleSaveData, buildReportSaveData } from '../lib/weeklyReportActions.js';
import WeeklyReportSourceRow from '../components/WeeklyReportSourceRow.jsx';

export default function WeeklyReport() {
  const { apiAvailable, data, error, setData } = useAppData();
  // Backlog.jsx/Schedule.jsx와 같은 이유(P5.4/P17/P19) — 여러 소스가 서로 다른(겹칠 수 있는)
  // 시점에 각자 저장을 시도할 수 있어, 저장을 순서대로 하나씩만 실행하는 큐로 직렬화한다(폴링
  // 대신 프라미스 체이닝 — Backlog.jsx의 mutex+재시도 방식보다 단순하게 처리 가능한 이유는 여기
  // 저장들은 "건너뛰고 나중에 재시도"가 아니라 "차례를 기다렸다 그대로 실행"해도 되기 때문).
  // critical-reviewer 지적(High): codex 생성은 최대 90초가 걸릴 수 있어, 그동안 사용자가 다른
  // 탭으로 이동하면 이 화면이 언마운트된다 — 언마운트돼도 이미 시작된 handleGenerate→
  // onSaveReport→enqueueSave 체인은 JS 프라미스라 계속 실행되는데, 그때 "탭을 떠나던 시점"의
  // 오래된 data로 전체 객체를 다시 쓰면 그 사이 다른 탭(할일/메모/설정 등)에서 생긴 변경이
  // 조용히 사라진다. dataRef 같은 렌더 시점 스냅샷 대신, 저장 직전에 항상 디스크의 최신
  // data를 다시 읽어(loadData) 그 위에 적용한다 — 언마운트 여부와 무관하게 항상 안전하다.
  const saveQueueRef = useRef(Promise.resolve());

  function enqueueSave(buildNewData) {
    const result = saveQueueRef.current.then(async () => {
      const current = await window.api.loadData();
      const newData = buildNewData(current);
      await window.api.saveData(newData);
      setData(newData);
      return newData;
    });
    // 체인 자체는 개별 저장이 실패해도 끊기지 않게 한다 — 실패 자체는 각 호출부가 `result`를
    // 직접 await해서 따로 처리한다(여기서 삼키는 건 "다음 저장을 계속 이어갈 수 있는지"뿐).
    saveQueueRef.current = result.then(
      () => {},
      () => {}
    );
    return result;
  }

  const [exampleDraft, setExampleDraft] = useState('');
  const [savingExample, setSavingExample] = useState(false);
  const [exampleSaveError, setExampleSaveError] = useState(null);
  // data가 처음 로드된 뒤 한 번만 draft 초기값을 채운다 — 이후 다른 이유로 data가 갱신돼도
  // (예: 소스별 결과 저장) 사용자가 입력 중인 draft를 덮어쓰지 않는다(ProjectEditForm 등 기존
  // 폼들의 "controlled local draft" 패턴과 동일).
  const initializedExampleRef = useRef(false);
  useEffect(() => {
    if (!data || initializedExampleRef.current) return;
    setExampleDraft(data.weekly_report_example || '');
    initializedExampleRef.current = true;
  }, [data]);

  async function handleSaveExample() {
    setSavingExample(true);
    setExampleSaveError(null);
    try {
      await enqueueSave((current) => buildExampleSaveData(current, exampleDraft));
    } catch (err) {
      setExampleSaveError(`저장하지 못했습니다. (${err && err.message ? err.message : String(err)})`);
    } finally {
      setSavingExample(false);
    }
  }

  async function handleSaveReport(sourceId, report) {
    await enqueueSave((current) => buildReportSaveData(current, sourceId, report));
  }

  if (!apiAvailable) {
    return (
      <>
        <h1>주간보고</h1>
        <div className="empty-state-card">
          <p>window.api를 사용할 수 없습니다 (Electron 렌더러 밖에서 실행 중).</p>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <h1>주간보고</h1>
        <div className="empty-state-card">
          <p>데이터를 불러오지 못했습니다: {error}</p>
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <h1>주간보고</h1>
        <div className="empty-state-card">
          <WeeklyReportIcon />
          <p>불러오는 중...</p>
        </div>
      </>
    );
  }

  const usableSources = getUsableBacklogSources(data.backlog_sources);

  return (
    <>
      <h1>주간보고</h1>
      <div className="card weekly-report-example-card">
        <div className="card-header">
          <h2 className="card-title">문체 예시 문장</h2>
        </div>
        <p className="weekly-report-example-hint">
          여기 적은 문장과 비슷한 문체로 codex가 주간보고를 작성합니다(모든 소스에 공통 적용).
        </p>
        <textarea
          className="weekly-report-example-textarea"
          value={exampleDraft}
          disabled={savingExample}
          onChange={(e) => setExampleDraft(e.target.value)}
          placeholder="예: 이번 주는 A 기능을 완료했고, 다음 주에는 B를 진행할 예정입니다."
          rows={3}
        />
        {exampleSaveError && <p className="data-issue-notice">{exampleSaveError}</p>}
        <button type="button" className="weekly-report-example-save" onClick={handleSaveExample} disabled={savingExample}>
          {savingExample ? '저장 중...' : '저장'}
        </button>
      </div>
      {usableSources.length === 0 ? (
        <p className="empty-text" title="등록된 외부 backlog(.json) 소스가 없습니다(설정 탭에서 먼저 등록하세요).">
          등록된 외부 backlog(.json) 소스가 없습니다(설정 탭에서 먼저 등록하세요).
        </p>
      ) : (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">소스별 주간보고</h2>
            <span className="card-count-badge">{usableSources.length}</span>
          </div>
          {usableSources.map((s) => (
            <WeeklyReportSourceRow
              key={s.id}
              source={s}
              exampleSentence={data.weekly_report_example}
              onSaveReport={handleSaveReport}
            />
          ))}
        </div>
      )}
    </>
  );
}
