// 화면 공통 IPC 로딩 훅. window.api.loadData()로 실제 data.json(제품 데이터 — projects/todos/
// memos/schedules)을 불러오는 로직이 여러 화면(Dashboard/Projects, 이후 Todos/Memos)에서 글자
// 단위로 반복되던 것을 하나로 모았다.
// 이름 주의: 이 파일이 다루는 "data.json"은 이 프로젝트 자체의 개발 진행을 추적하는
// backlog.json(scripts/backlog/cli.js, .claude/hooks/block-backlog-direct-read.js 전용)과
// 전혀 다른 대상이다 — 훅 이름에 "backlog"를 쓰지 않은 이유이기도 하다.
//
// P2.3(할일 인라인 추가)에서 처음으로 saveData() 후 화면 갱신이 필요해져 setData를 노출한다.
// window.api.saveData(newData)가 성공한 뒤 호출부가 setData(newData)로 로컬 상태를 낙관적으로
// 갱신하는 방식 — saveData는 dataStore.js에서 원자적 쓰기(임시파일 후 rename)라 실패 시
// 예외를 던지고 파일은 그대로 남으므로, 호출부가 saveData를 await한 뒤에만 setData해야
// "저장 실패했는데 화면은 성공한 것처럼 보이는" 상태를 피할 수 있다.
// disk에서 다시 읽어오는(reload) 방식이 아니라 호출부가 이미 구성한 newData를 그대로 반영하는
// 이유: saveData가 원자적으로 성공했다면 disk 내용은 newData와 동일하다고 신뢰할 수 있어
// 왕복 IPC 호출 하나를 아낄 수 있다(P4.2 메모 CRUD도 착수 시 이 패턴을 그대로 따르면 됨) —
// 단, 이건 "한 화면에 저장 호출 지점이 하나뿐이고 폼이 자체적으로 중복 제출을 막는" 지금
// 상황에서만 안전하다(P2.3 리뷰에서 확인). newData는 호출부가 렌더 시점의 data 클로저를 보고
// 미리 구성해두는 값이라, 같은 화면 안에 저장 호출 지점이 여러 개 생기고 그것들이 겹쳐 실행될
// 수 있게 되는 순간(예: 여러 항목을 동시에 토글/삭제) 나중에 끝난 저장이 먼저 끝난 저장 결과를
// 통째로 덮어써 조용히 되돌릴 수 있다 — 그 시점이 오면 함수형 갱신이나 저장 직렬화가 필요하다.
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

    function load() {
      window.api
        .loadData()
        .then((result) => {
          // P1.6: 재표시마다 load()가 다시 불릴 수 있으므로, 성공 시 이전에 세팅됐을 수 있는
          // error를 반드시 지운다 — 화면들이 전부 `if (error) ... else if (!data) ...` 순서로
          // 분기해서, error를 안 지우면 한 번 실패한 뒤로는 재조회가 아무리 성공해도 에러 카드에
          // 영구히 갇힌다(critical-reviewer 지적).
          if (!ignore) {
            setError(null);
            setData(result);
          }
        })
        .catch((err) => {
          if (!ignore) setError(String(err?.message || err) || '알 수 없는 오류');
        });
    }

    load();
    // P1.6: X닫기는 hide일 뿐 destroy가 아니라(B5.1) 트레이에 며칠 떠 있어도 React 트리가
    // 마운트 시점 데이터를 그대로 들고 있었다 — main.js가 창을 다시 보여줄 때마다 쏘는
    // 'data:changed'를 구독해 다시 불러온다. 이 훅을 쓰는 화면(Dashboard/Todos/Projects)이
    // 전부 자동으로 적용받으므로 화면마다 따로 구독할 필요가 없다.
    const unsubscribe = window.api.onDataChanged?.(load);

    return () => {
      ignore = true;
      unsubscribe?.();
    };
  }, [apiAvailable]);

  return { apiAvailable, data, error, setData };
}
