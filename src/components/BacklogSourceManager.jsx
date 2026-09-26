// P14.1(사람 결정): 다른 프로젝트의 backlog(.json) 파일을 여러 개 등록/삭제하는 관리 UI.
// ScheduleCategoryManager.jsx와 같은 시각 스타일을 쓴다. (P15에서 위치가 바뀌었다 — 원래는
// 일정 화면 안 접이식 진입점이었지만, 캘린더를 가린다는 피드백으로 전용 "설정" 탭
// (src/screens/Settings.jsx)으로 옮겨졌고 접이식 토글도 없어졌다.)
// 등록은 네이티브 파일 선택 다이얼로그로만 하고(사용자가 긴 경로를 직접 타이핑하지 않음),
// 위젯은 그 경로에 절대 쓰지 않는다(읽기 전용, 사람 결정) — 각 프로젝트 자신의 backlog(.json)
// CLI/훅 거버넌스를 이 위젯이 우회하지 않도록 하기 위함.
import { useState } from 'react';
import { getUsableBacklogSources, getSourceDisplayLabel } from '../lib/backlogSourceMutations.js';
import { useBacklogSourceRead } from '../lib/useBacklogSourceRead.js';

// 등록 직후 그 소스가 실제로 읽히는지(경로 존재/JSON 파싱 가능 여부) 한 번 확인해 보여준다 —
// P14.1 done_when("등록된 경로가 존재하지 않거나 JSON 파싱에 실패해도... 그 소스만 오류로
// 표시한다")을 이 관리 화면 자체에서도 충족한다. 전체 task 목록 나열은 P14.2(BacklogStatusPanel.jsx,
// 같은 useBacklogSourceRead 훅 공유)의 몫이라 여기서는 개수/오류 한 줄 요약만 보여준다.
function SourceStatus({ path }) {
  const state = useBacklogSourceRead(path);

  if (state.loading) return <span className="backlog-source-status">확인 중...</span>;
  if (!state.ok) return <span className="backlog-source-status is-error">{state.error}</span>;
  // critical-reviewer 지적(P14.1 리뷰, Medium): "인식 못 한 형식이라 목록이 비어있음"과
  // "id 없는 항목이라 걸러짐"과 "실제로 비어있는 backlog"가 전부 "정상 (task 0개)"로 똑같이
  // 보이면 사용자가 구분할 수 없다 — 세 경우를 서로 다른 문구로 나눈다.
  if (!state.recognized) {
    return <span className="backlog-source-status is-warn">인식 가능한 task 배열을 찾지 못했습니다.</span>;
  }
  return (
    <span className="backlog-source-status is-ok">
      정상 (task {state.tasks.length}개{state.skippedCount > 0 ? `, id 없는 항목 ${state.skippedCount}개 제외` : ''})
    </span>
  );
}

function SourceRow({ source, onDelete, disabled }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const busy = deleting || disabled;

  return (
    <li className="backlog-source-row">
      <span className="backlog-source-info">
        <span className="backlog-source-label">{getSourceDisplayLabel(source)}</span>
        <span className="backlog-source-path" title={source.path}>
          {source.path}
        </span>
        <SourceStatus path={source.path} />
      </span>
      {confirmingDelete ? (
        <span className="todo-delete-confirm">
          정말 삭제할까요?
          <button
            type="button"
            className="todo-delete-toggle"
            disabled={busy}
            onClick={async () => {
              setDeleting(true);
              try {
                await onDelete(source.id);
              } catch (err) {
                console.error('backlog(.json) 소스 삭제 실패:', err);
                setError('삭제하지 못했습니다.');
                setDeleting(false);
              }
            }}
          >
            확인
          </button>
          <button
            type="button"
            className="delete-cancel-button"
            disabled={busy}
            onClick={() => setConfirmingDelete(false)}
          >
            취소
          </button>
        </span>
      ) : (
        <button type="button" className="todo-delete-toggle" disabled={disabled} onClick={() => setConfirmingDelete(true)}>
          삭제
        </button>
      )}
      {error && <p className="data-issue-notice">{error}</p>}
    </li>
  );
}

export default function BacklogSourceManager({ sources, onAdd, onDelete, disabled = false }) {
  const [pickError, setPickError] = useState(null);
  // critical-reviewer 지적(P14.1 리뷰, Medium): 네이티브 다이얼로그는 사용자가 실제로 파일을
  // 고를 때까지 수 초~수 분 열려 있을 수 있는데, 그동안 버튼이 활성 상태로 남아있으면 두 번
  // 눌러 handleBrowse가 겹쳐 실행될 수 있다(둘 다 같은 시점의 onAdd 클로저를 써서 저장이
  // 꼬일 위험) — 다이얼로그가 열려 있는 동안은 버튼을 막는다.
  const [picking, setPicking] = useState(false);
  const usableSources = getUsableBacklogSources(sources);
  const busy = disabled || picking;

  async function handleBrowse() {
    setPickError(null);
    setPicking(true);
    try {
      const path = await window.api.pickBacklogSourceFile();
      if (!path) return; // 사용자가 다이얼로그를 취소함 — 조용히 아무것도 안 함
      await onAdd(path);
    } catch (err) {
      console.error('backlog(.json) 소스 추가 실패:', err);
      setPickError('소스를 추가하지 못했습니다.');
    } finally {
      setPicking(false);
    }
  }

  return (
    <>
      {usableSources.length === 0 ? (
        <p className="empty-text">등록된 외부 backlog(.json) 소스가 없습니다.</p>
      ) : (
        <ul className="card-list">
          {usableSources.map((s) => (
            <SourceRow key={s.id} source={s} onDelete={onDelete} disabled={disabled} />
          ))}
        </ul>
      )}
      <button type="button" className="project-edit-save" disabled={busy} onClick={handleBrowse}>
        + backlog(.json) 파일 선택해서 등록
      </button>
      {pickError && <p className="data-issue-notice">{pickError}</p>}
    </>
  );
}
