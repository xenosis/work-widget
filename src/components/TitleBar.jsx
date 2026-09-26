// P12.3(P12.2 사람 결정: frame:false 완전 커스텀): 네이티브 타이틀바를 없앤(electron/main.js의
// BrowserWindow frame:false) 대신, 드래그 가능한 영역 + 앱 이름 + 최소화/최대화/닫기 버튼을
// 렌더러가 직접 그린다 — 다크 글래스 테마(index.css)가 타이틀바에도 그대로 적용되게 하기
// 위함(네이티브 타이틀바는 OS가 그려서 웹 콘텐츠의 색이 안 미침, P12.13/P12.19에서 겪은
// select/date 팝업과 같은 종류의 제약을 창 자체에서도 피하는 방식).
// 버튼/드래그 영역은 CSS의 -webkit-app-region(index.css)으로 구현하고, 실제 창 제어는
// electron/preload.js가 노출한 IPC(window.api.minimizeWindow 등)를 통해 메인 프로세스가
// 수행한다 — B5.1(닫기=트레이로 숨김, 완전 종료 아님) 로직은 electron/main.js의 기존 'close'
// 이벤트 핸들러가 그대로 담당하므로(닫기 버튼은 mainWindow.close()만 호출), 여기서 따로
// 재구현하지 않는다.
import { useEffect, useState } from 'react';
import { MinimizeIcon, MaximizeIcon, RestoreIcon, CloseIcon } from './icons.jsx';

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  // critical-reviewer 지적(재검증, Medium): onMaximizedChange는 상태가 "바뀔 때"만 알려줘서
  // 초기값이 항상 false였다 — 창이 이미 최대화된 채로 마운트/새로고침되면 다음 상태 변화
  // 전까지 아이콘/aria-label이 실제와 어긋났다. 마운트 시 한 번 현재 상태를 직접 물어본다.
  useEffect(() => {
    let cancelled = false;
    window.api
      ?.isMaximized?.()
      .then((value) => {
        if (!cancelled) setIsMaximized(value);
      })
      // critical-reviewer 지적(재검증, Medium): .catch가 없어 IPC 핸들러가 응답하지 않는
      // 경로(예: 개발 중 메인 프로세스는 안 바뀌고 렌더러만 HMR로 새로고침되는 경우)에서
      // unhandled rejection이 콘솔에 남을 수 있었다 — 초기 상태 조회 실패는 무해하므로
      // (다음 maximize/unmaximize 이벤트가 오면 어차피 정확한 값으로 갱신됨) 조용히 무시한다.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!window.api?.onMaximizedChange) return undefined;
    return window.api.onMaximizedChange(setIsMaximized);
  }, []);

  function handleDoubleClick() {
    window.api?.toggleMaximize();
  }

  return (
    <div className="titlebar">
      <div className="titlebar-drag-region" onDoubleClick={handleDoubleClick}>
        <span className="titlebar-title">TaskDock</span>
      </div>
      <div className="titlebar-controls">
        <button
          type="button"
          className="titlebar-button"
          onClick={() => window.api?.minimizeWindow()}
          aria-label="최소화"
        >
          <MinimizeIcon width={14} height={14} />
        </button>
        <button
          type="button"
          className="titlebar-button"
          onClick={() => window.api?.toggleMaximize()}
          aria-label={isMaximized ? '이전 크기로 복원' : '최대화'}
        >
          {isMaximized ? <RestoreIcon width={14} height={14} /> : <MaximizeIcon width={14} height={14} />}
        </button>
        <button
          type="button"
          className="titlebar-button titlebar-close"
          onClick={() => window.api?.closeWindow()}
          aria-label="닫기(트레이로 숨김)"
        >
          <CloseIcon width={14} height={14} />
        </button>
      </div>
    </div>
  );
}
