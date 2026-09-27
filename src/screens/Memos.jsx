import { useEffect, useRef, useState } from 'react';
import { useAppData } from '../lib/useAppData.js';
import { createMemo } from '../lib/memoFactory.js';
import { applyMemoUpdate, removeMemo } from '../lib/memoMutations.js';
import { getProjectName, getUsableProjects, isOrphanProjectRef } from '../lib/projectLookup.js';

// B2.3: 좌측 메모 목록 + 우측 편집창.
// P4.2: 제목/본문은 폼 제출형(Todos/Projects)이 아니라 자유 타이핑 텍스트라, 키 입력마다
// saveData를 부르면 IPC/디스크 쓰기가 폭주하고 화면 단위 saving 가드 없이 계속 겹쳐 실행될
// 여지가 생긴다. 그래서 타이핑은 로컬 state(setData, 낙관적)만 즉시 갱신하고, 디스크 저장은
// 마지막 입력 후 AUTOSAVE_DELAY_MS만큼 조용해지면 한 번만 나가도록 디바운스한다. 추가/삭제는
// 그 자체가 이산적인 동작이라 디바운스 없이 즉시 저장한다. savingRef/pendingRef는 "저장 중에
// 또 바뀌면 그 최신 상태로 한 번 더 저장"을 보장하는 최소 코얼레싱 큐 — dataRef가 항상
// 최신 data를 가리키므로 몇 번을 겹쳐 불러도 최종적으로는 최신 내용이 디스크에 남는다.
// 저장이 실패해도 RETRY_DELAY_MS 뒤에 자동으로 재시도한다(critical-reviewer 지적: 재시도가
// 없으면 실패 이후 사용자가 다시 타이핑하지 않는 한 영원히 저장되지 않는다 — Todos.jsx가
// 실패를 throw해 폼이 입력을 보존·표시하는 것과 같은 이유로, 여기서도 "실패를 그냥 삼키지
// 않는다"는 원칙을 재시도로 구현). 실패 재시도는 성공 시의 즉시 코얼레싱과 달리 지연을 두는데
// — 디스크가 영구적으로 못 쓰는 상태(예: 용량 초과)라면 지연 없이 즉시 재시도할 경우 IPC를
// 가득 채우며 무한히 도는 재시도 폭주가 되기 때문이다(자체 검증 중 권한 오류를 실제로 유도해
// 1초 만에 300회 넘게 재시도하는 것을 확인 — 그 뒤 이 지연을 추가함).
const AUTOSAVE_DELAY_MS = 600;
const RETRY_DELAY_MS = 2000;

async function flushSave(dataRef, savingRef, pendingRef, setSaveError) {
  if (savingRef.current) {
    pendingRef.current = true;
    return;
  }
  savingRef.current = true;
  try {
    await window.api.saveData(dataRef.current);
  } catch (err) {
    console.error('메모 저장 실패:', err);
    setSaveError('메모를 저장하지 못했습니다. 다시 시도합니다...');
    savingRef.current = false;
    // 재시도 대기 구간(최대 RETRY_DELAY_MS)에도 pendingRef를 세워둔다 — 그래야 재조회 가드
    // (아래 useEffect)가 이 구간도 "저장 관련 활동 중"으로 보고 dataRef를 지켜준다. 재시도 대기
    // 중엔 savingRef/timerRef 둘 다 false/null이라 pendingRef 없이는 가드가 통째로 빈다
    // (critical-reviewer [High] 지적 — 저장 실패가 실제로 재현된 경로라 이론상 가정이 아님).
    pendingRef.current = true;
    setTimeout(() => flushSave(dataRef, savingRef, pendingRef, setSaveError), RETRY_DELAY_MS);
    return;
  }
  setSaveError(null);
  savingRef.current = false;
  if (pendingRef.current) {
    pendingRef.current = false;
    flushSave(dataRef, savingRef, pendingRef, setSaveError);
  }
}

export default function Memos() {
  const { apiAvailable, data, error, setData } = useAppData();
  const [selectedId, setSelectedId] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const dataRef = useRef(data);
  const savingRef = useRef(false);
  const pendingRef = useRef(false);
  const timerRef = useRef(null);

  // 디바운스 대기 중이거나 저장(재시도 포함)이 진행 중일 때는 백그라운드 재조회(P1.6의
  // 'data:changed' — 예: 창 재표시)가 dataRef를 디스크의 옛 버전으로 되돌리지 않게 막는다.
  // 그래야 그 사이 밀려 있던 편집이 저장 시점에 조용히 사라지지 않는다(critical-reviewer
  // 지적). 화면에 보이는 값(data.memos)까지 재조회로 잠깐 바뀔 수 있는 것은 남은 한계이며,
  // P2.9(재조회-편집폼 충돌 정책)에 이 화면도 해당한다고 별도로 남겨뒀다.
  useEffect(() => {
    if (timerRef.current || savingRef.current || pendingRef.current) return;
    dataRef.current = data;
  }, [data]);

  // 화면을 떠나면(다른 사이드바 메뉴로 이동) 대기 중인 디바운스 저장을 즉시 흘려보낸다 —
  // 최선의 노력이며 await하지 않는다(언마운트 이후 컴포넌트의 setState는 의미가 없으므로
  // 실패해도 조용히 넘어간다). X닫기(트레이로 숨김)는 B5.1대로 destroy가 아니라 렌더러
  // 프로세스가 계속 살아있으므로 이 언마운트 경로를 안 타도 대기 중인 setTimeout은 그대로
  // 발화한다 — electron/main.js가 이 창에 backgroundThrottling:false를 줘서 숨겨진 동안도
  // 타이머가 지연되지 않게 한다.
  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        flushSave(dataRef, savingRef, pendingRef, () => {});
      }
    },
    []
  );

  if (!apiAvailable) {
    return (
      <>
        <h1>메모</h1>
        <div className="empty-state-card">
          <p>window.api를 사용할 수 없습니다 (Electron 렌더러 밖에서 실행 중).</p>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <h1>메모</h1>
        <div className="empty-state-card">
          <p>데이터를 불러오지 못했습니다: {error}</p>
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <h1>메모</h1>
        <div className="empty-state-card">
          <p>불러오는 중...</p>
        </div>
      </>
    );
  }

  // id가 없거나 형식이 잘못된 레코드는 다른 화면들(Todos.jsx/Projects.jsx)과 동일하게 "표시"
  // 에서만 제외한다 — 저장까지 이 걸러진 목록을 기준으로 하면 그 레코드가 디스크에서 통째로
  // 사라지는 훨씬 나쁜 사고가 된다(자체 검증 중 발견: applyMemoUpdate/removeMemo에 필터된
  // memos를 넘겼더니 깨진 레코드가 저장 시 조용히 삭제됨). 그래서 저장 경로(scheduleAutosave/
  // handleAddMemo/handleDeleteMemo)는 항상 data.memos(원본 전체)를 기준으로 하고, 화면
  // 렌더링에만 visibleMemos를 쓴다.
  const visibleMemos = data.memos.filter((m) => m && typeof m.id === 'string');
  const droppedCount = data.memos.length - visibleMemos.length;
  const selected = visibleMemos.find((m) => m.id === selectedId) ?? null;
  // P4.4: Todo의 project_id(B3.2상 필수)와 달리 Memo의 project_id는 nullable이라(B3.3)
  // "전체 메모"로 선택 해제할 수 있어야 한다 — 그래서 getUsableProjects로 거른 목록에
  // TodoAddForm/TodoEditForm처럼 선택을 강제하지 않고, 빈 값을 "전체 메모"라는 정상 옵션으로
  // 항상 보여준다. 현재 project_id가 그 목록에 없으면(소속 프로젝트가 삭제된 고아 메모, P2.8
  // 미결) select는 "전체 메모"로 표시하되, 사용자가 select를 건드리지 않는 한 실제 project_id는
  // 조용히 바뀌지 않는다(제목만 고치는 사용자가 의도치 않게 소속을 잃지 않도록). 고아 상태는
  // select 옵션에 "(삭제된 프로젝트)"를 별도로 렌더해 실제 project_id를 value로 쓴다 — 안
  // 그러면 고아 상태도 "전체 메모"와 같은 value("")로 보여, 그 상태에서 "전체 메모"를 다시
  // 골라도 select의 값이 안 바뀌어 change 이벤트가 안 떠 영영 해제가 안 된다(critical-reviewer
  // [High] 지적).
  const usableProjects = getUsableProjects(data.projects);
  const selectedIsOrphan = selected ? isOrphanProjectRef(data.projects, selected.project_id) : false;

  // 재조회 가드(useEffect)가 지켜주는 건 dataRef뿐이다 — 저장 경로가 dataRef 대신 렌더 시점
  // state인 data를 기준으로 다음 상태를 만들면, 디바운스/재시도 대기 중 재조회로 data가 옛
  // 디스크 내용으로 바뀌었을 때 그 위에 다음 편집을 쌓아 방금 디스크에 저장된 변경을 되돌리게
  // 된다(critical-reviewer [High] 지적 — 가드를 "지키는 값"과 "다음 편집이 베이스로 쓰는 값"이
  // 서로 달랐던 것이 원인). 항상 dataRef.current를 베이스로 삼아 이 둘을 일치시킨다.
  function baseData() {
    return dataRef.current ?? data;
  }

  function scheduleAutosave(nextMemos) {
    const newData = { ...baseData(), memos: nextMemos };
    setData(newData);
    dataRef.current = newData;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      flushSave(dataRef, savingRef, pendingRef, setSaveError);
    }, AUTOSAVE_DELAY_MS);
  }

  function updateSelected(patch) {
    if (!selected) return;
    scheduleAutosave(applyMemoUpdate(baseData().memos, selected.id, patch));
  }

  async function handleAddMemo() {
    const blank = createMemo();
    const base = baseData();
    const newData = { ...base, memos: [blank, ...base.memos] };
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setData(newData);
    dataRef.current = newData;
    setSelectedId(blank.id);
    await flushSave(dataRef, savingRef, pendingRef, setSaveError);
  }

  async function handleDeleteMemo() {
    if (!selected) return;
    const base = baseData();
    const newData = { ...base, memos: removeMemo(base.memos, selected.id) };
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setData(newData);
    dataRef.current = newData;
    setSelectedId(null);
    setConfirmingDelete(false);
    await flushSave(dataRef, savingRef, pendingRef, setSaveError);
  }

  return (
    <>
      <h1>메모</h1>
      {droppedCount > 0 && (
        <p className="data-issue-notice">
          id가 없거나 형식이 잘못된 메모 {droppedCount}개는 목록에 표시되지 않습니다 (data.json 확인 필요)
        </p>
      )}
      <div className="memos-layout">
        <div className="memo-list">
          <button className="memo-add-btn" onClick={handleAddMemo}>
            + 새 메모
          </button>
          {visibleMemos.length === 0 && <p className="empty-text">메모가 없습니다.</p>}
          <ul>
            {visibleMemos.map((m) => {
              const projectName = getProjectName(data.projects, m.project_id);
              return (
                <li key={m.id}>
                  <button
                    className={m.id === selectedId ? 'memo-list-item active' : 'memo-list-item'}
                    onClick={() => {
                      setSelectedId(m.id);
                      setConfirmingDelete(false);
                    }}
                  >
                    <span className="memo-list-title">{m.title || '(제목 없음)'}</span>
                    {projectName && <span className="memo-tag">{projectName}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="memo-editor">
          {/* selected가 없어질 때(삭제 등)도 방금 뜬 저장 오류가 화면에서 사라지지 않도록
              selected 분기 밖에 둔다(critical-reviewer 지적: 삭제 저장이 실패해도 표시할
              위치가 없어 무음으로 실패했었음). */}
          {saveError && <p className="data-issue-notice">{saveError}</p>}
          {selected ? (
            <>
              <select
                className="memo-project-select"
                aria-label="소속 프로젝트"
                value={selectedIsOrphan ? selected.project_id : selected.project_id ?? ''}
                onChange={(e) => updateSelected({ project_id: e.target.value || null })}
              >
                <option value="">전체 메모</option>
                {selectedIsOrphan && <option value={selected.project_id}>(삭제된 프로젝트)</option>}
                {usableProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                className="memo-title-input"
                type="text"
                value={selected.title ?? ''}
                placeholder="제목"
                onChange={(e) => updateSelected({ title: e.target.value })}
              />
              <textarea
                className="memo-content-input"
                value={selected.content ?? ''}
                placeholder="내용을 입력하세요"
                onChange={(e) => updateSelected({ content: e.target.value })}
              />
              {confirmingDelete ? (
                <span className="todo-delete-confirm">
                  정말 삭제할까요?
                  <button type="button" className="todo-delete-toggle" onClick={handleDeleteMemo}>
                    확인
                  </button>
                  <button type="button" className="delete-cancel-button" onClick={() => setConfirmingDelete(false)}>
                    취소
                  </button>
                </span>
              ) : (
                <button type="button" className="todo-edit-toggle" onClick={() => setConfirmingDelete(true)}>
                  메모 삭제
                </button>
              )}
            </>
          ) : (
            <p className="empty-text" title="왼쪽 목록에서 메모를 선택하거나 새 메모를 추가하세요.">
              왼쪽 목록에서 메모를 선택하거나 새 메모를 추가하세요.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
