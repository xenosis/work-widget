// 화면 공통 IPC 로딩 훅. window.api.loadData()로 실제 data.json(제품 데이터 — projects/todos/
// memos/schedules)을 불러오는 로직이 여러 화면(Dashboard/Projects, 이후 Todos/Memos)에서 글자
// 단위로 반복되던 것을 하나로 모았다.
// 이름 주의: 이 파일이 다루는 "data.json"은 이 프로젝트 자체의 개발 진행을 추적하는
// backlog.json(scripts/backlog/cli.js, .claude/hooks/block-backlog-direct-read.js 전용)과
// 전혀 다른 대상이다 — 훅 이름에 "backlog"를 쓰지 않은 이유이기도 하다.
//
// 읽기 전용이다: data/error만 반환하고 reload()나 setData 같은 갱신 수단이 없다. P2.5(프로젝트
// CRUD)/P4.2(메모 CRUD)는 saveData() 호출 후 화면을 갱신해야 하는데, 지금 이 훅만으로는 그걸
// 할 수 없다 — 그 두 task를 시작할 때 이 훅에 reload 기능을 추가해야 한다(지금 미리 만들지
// 않음 — 아직 쓰는 곳이 없는 기능을 먼저 만들지 않는다).
//
// 렌더링(제목, 빈 상태 문구 등)은 화면마다 다르므로 훅에 포함하지 않고 호출부에서 그대로 처리한다.
import { useEffect, useState } from 'react';

export function useAppData() {
  const apiAvailable = Boolean(window.api?.loadData);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!apiAvailable) return;
    let ignore = false;
    window.api
      .loadData()
      .then((result) => {
        if (!ignore) setData(result);
      })
      .catch((err) => {
        if (!ignore) setError(String(err?.message || err) || '알 수 없는 오류');
      });
    return () => {
      ignore = true;
    };
  }, [apiAvailable]);

  return { apiAvailable, data, error };
}
