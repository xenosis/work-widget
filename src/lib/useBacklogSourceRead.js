import { useEffect, useState } from 'react';

// P14.2: BacklogSourceManager.jsx(P14.1)의 SourceStatus와 이 task의 BacklogStatusPanel.jsx가
// 둘 다 "등록된 소스 하나를 IPC로 읽어 로딩/성공/실패 상태로 들고 있는다"는 같은 로직이
// 필요해서 공용 훅으로 뽑는다(getDayCellClassNames 등 이 세션 내내 반복된 "두 곳이 같은
// 로직을 각자 구현하면 갈라진다" 원칙과 같은 이유). 실제 React 훅(useState/useEffect를 씀)이라
// "use" 접두어가 맞다 — scheduleCategoryActions.js 등과는 반대 경우.
// critical-reviewer 지적(P17 리뷰, Medium): 원래 이 훅은 path가 바뀌지 않는 한(사실상 마운트
// 중 절대 안 바뀜) 한 번만 읽었다 — P14.1 당시 그것으로 충분했다. P17에서 "이번 주 들어 처음
// 읽은 상태"를 주간 기준선으로 자동 저장하게 되면서, 패널을 펼친 채로 오래 켜 둔 상태에서 주가
// 바뀌면(예: 금요일에 펼쳐 두고 그다음 주 화요일까지 계속 떠 있는 경우) 마운트 시점의 오래된
// state.tasks가 "이번 주 기준선"으로 잘못 저장될 위험이 생겼다 — refreshKey(호출부가 "이 값이
// 바뀌면 다시 읽어야 한다"고 판단하는 값, 예: 이번 주 월요일 날짜)를 선택적으로 받아 그 값이
// 바뀔 때도 다시 읽도록 확장한다. 기존 호출부(BacklogSourceManager.jsx)는 이 인자를 안 넘기면
// undefined로 고정이라 동작이 그대로다.
export function useBacklogSourceRead(path, refreshKey) {
  const [state, setState] = useState({
    loading: true,
    ok: null,
    tasks: [],
    recognized: null,
    skippedCount: 0,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    window.api
      .readBacklogSourceTasks(path)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setState({
            loading: false,
            ok: true,
            tasks: result.tasks,
            recognized: result.recognized,
            skippedCount: result.skippedCount,
            error: null,
          });
        } else {
          setState({ loading: false, ok: false, tasks: [], recognized: null, skippedCount: 0, error: result.error });
        }
      })
      // IPC 자체가 reject되는 경우(전송 실패 등)까지 잡아야 "확인 중..."에서 영구히 멈추지
      // 않는다(critical-reviewer 지적, P14.1 리뷰).
      .catch((err) => {
        if (cancelled) return;
        setState({ loading: false, ok: false, tasks: [], recognized: null, skippedCount: 0, error: String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [path, refreshKey]);

  return state;
}
