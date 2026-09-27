const { app, Menu } = require('electron');

// P29(사용자 요청, 2026-09-27): 트레이 우클릭 메뉴에 "완전히 종료"와 "자동 실행" 토글을
// 추가한다 — 기존엔 프로세스를 완전히 끄려면 작업 관리자를 직접 열어야 했는데(B5.2 "별도
// 종료 메뉴 없음" 결정을 사용자가 직접 번복 — 재빌드/재실행 반복 중 매번 작업 관리자로
// 끄는 게 번거롭다는 요청), 그 번거로움을 없앤다. `app.quit()`을 부르면 main.js의
// before-quit 리스너가 `app.isQuitting = true`를 먼저 설정하므로, mainWindow의 close
// 핸들러(B5.1의 hide-to-tray 분기)가 자연스럽게 우회돼 여기서 별도로 플래그를 조작할 필요가
// 없다.
//
// critical-reviewer 지적(Medium): 메뉴 구조 조립(어떤 라벨/타입/체크 상태를 갖는지, 클릭
// 시 어떤 콜백을 부르는지)과, 그 콜백이 실제로 무엇을 하는지(app.quit() 등 진짜 Electron
// API 호출)를 분리한다 — 앞엣것은 electron을 전혀 안 써서 vitest로 그대로 검증 가능하다
// (이 프로젝트의 실제 전례는 "electron 없음"이 아니라 "순수 로직만 떼어 테스트"임,
// autoLaunch.test.js 참고 — 처음엔 이 분리를 안 하고 "vitest 자체를 포기"라고 잘못 적었었다).
function buildTrayMenuTemplate({ openAtLogin, autoLaunchToggleEnabled, onToggleVisibility, onToggleAutoLaunch, onQuit }) {
  return [
    { label: '열기/숨기기', click: onToggleVisibility },
    { type: 'separator' },
    {
      label: 'Windows 시작 시 자동 실행',
      type: 'checkbox',
      checked: openAtLogin,
      // critical-reviewer 지적(High): 이 체크박스에 app.isPackaged 가드가 없어서, 개발
      // 모드(npm run dev)에서 누르면 개발용 electron.exe 자체가(앱 경로 인자 없이) 실제
      // Windows 시작 프로그램에 등록되는 부작용이 있었다 — configureAutoLaunch(P7.2)가
      // 정확히 이 부작용을 막으려고 app.isPackaged 가드를 둔 것과 같은 이유. 패키지
      // 빌드가 아니면 항목 자체를 비활성화(회색, 클릭 무시)한다.
      enabled: autoLaunchToggleEnabled,
      click: (menuItem) => onToggleAutoLaunch(menuItem.checked),
    },
    { type: 'separator' },
    { label: '완전히 종료', click: onQuit },
  ];
}

// 실제 Electron API를 부르는 얇은 층 — 여기만 electron 의존이라 vitest 대상에서 뺀다(위 순수
// 함수만 검증한다).
function buildTrayMenu({ getMainWindow }) {
  const template = buildTrayMenuTemplate({
    openAtLogin: app.getLoginItemSettings().openAtLogin,
    autoLaunchToggleEnabled: app.isPackaged,
    onToggleVisibility: () => {
      const win = getMainWindow();
      if (!win || win.isDestroyed()) return;
      win.isVisible() ? win.hide() : win.show();
    },
    onToggleAutoLaunch: (checked) => app.setLoginItemSettings({ openAtLogin: checked }),
    onQuit: () => app.quit(),
  });
  return Menu.buildFromTemplate(template);
}

module.exports = { buildTrayMenu, buildTrayMenuTemplate };
