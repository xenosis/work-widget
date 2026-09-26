const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, nativeTheme } = require('electron');
const path = require('path');
const { loadData, saveData, migrateLegacyUserData } = require('./dataStore');
const { loadWindowState, saveWindowState, MIN_WINDOW_SIZE } = require('./windowState');
const { getAutoLaunchFlagPath, hasRegisteredAutoLaunch, markAutoLaunchRegistered } = require('./autoLaunch');
const { registerWindowControls, forwardMaximizeState } = require('./windowControls');
const { registerBacklogSourceHandlers } = require('./backlogSources');

let mainWindow;
let tray;

// P7.6: P7.2(로그인 자동 실행)로 트레이 상주 프로세스가 로그인 시 항상 떠 있는 게 일상이 되면,
// 사용자가 바탕화면/시작메뉴 바로가기로 앱을 또 실행할 가능성이 커진다(critical-reviewer 지적,
// P7.2 리뷰) — 두 번째 인스턴스가 그대로 뜨면 트레이 아이콘 2개, 창 2개가 생기고 두 프로세스가
// 같은 data.json/window-state.json을 각자 통째로 덮어써 한쪽 편집이 유실될 수 있다. 락을 못
// 받으면(이미 다른 인스턴스가 실행 중) 창/트레이를 만들기 전에 바로 종료해 그 경합 자체가
// 생기지 않게 한다. Node CommonJS 모듈 최상위의 return은 유효하다(각 파일이 함수로 감싸져
// 실행됨) — 이후 코드(app.whenReady 등) 전체를 else로 감싸는 대신 여기서 바로 빠져나온다.
// critical-reviewer 지적: 이 return은 이 파일이 CJS로 로드된다는 전제에 기댄다 —
// package.json에 "type":"module"을 추가하거나 이 파일을 .mjs로 바꾸면 SyntaxError가 나서 앱
// 전체가 뜨지 않는다. 이 프로젝트는 electron/scripts 전역을 commonjs로 통일하고 있어(eslint.config.js)
// 바뀔 계획이 없지만, 나중에 이 파일을 손대는 사람을 위해 여기 남긴다.
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  return;
}

app.on('second-instance', () => {
  // 두 번째 실행 시도가 있었다는 신호 — 새 창을 만들지 않고 기존 창을 앞으로 가져온다.
  // isDestroyed() 가드는 이 파일의 다른 리스너(captureAndSaveWindowState, notifyDataChanged)와
  // 같은 이유 — 종료 시퀀스 도중(session-end 이후 창이 실제로 파괴되는 짧은 구간) 두 번째
  // 실행 시도가 들어오면 파괴된 BrowserWindow 호출이 예외를 던질 수 있다(critical-reviewer 지적).
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

function createWindow() {
  // P7.5 결정(사람, 2026-09-25): 저장된 위치/크기가 있고 지금 연결된 화면 안에 있으면 그대로
  // 쓰고, 없거나(최초 실행) 화면 밖이면(모니터 구성 변경) 기본값으로 시작한다.
  const savedState = loadWindowState();
  mainWindow = new BrowserWindow({
    width: savedState ? savedState.width : 420,
    height: savedState ? savedState.height : 640,
    ...(savedState ? { x: savedState.x, y: savedState.y } : {}),
    // P12.2 결정(사람, 2026-09-25): 방식 (a)/(b)/(c) 중 (c) frame:false 완전 커스텀으로
    // 진행 — 최소화/최대화/닫기 버튼까지 렌더러(TitleBar.jsx)가 직접 그린다(P12.3). 네이티브
    // 타이틀바는 OS가 그려서 다크 글래스 테마가 안 먹지만(P12.13/P12.19의 select/date 팝업과
    // 같은 종류의 제약), frame:false는 타이틀바 자체를 웹 콘텐츠로 만들어 이 제약을 원천적으로
    // 피한다. backgroundColor는 렌더러 CSS가 아직 로드/페인트되기 전 잠깐 보일 수 있는 흰
    // 배경(frame:false 창의 흔한 문제)을 막기 위함 — index.css의 --bg(oklch(20% 0.02 260))에
    // 근접한 근사 hex 값이다(oklch→hex 변환 라이브러리가 없어 눈대중 근사, 어차피 페인트 전
    // 아주 짧게만 보이므로 완벽히 일치할 필요는 없음).
    frame: false,
    backgroundColor: '#1a1c24',
    // P7.4 결정: B1.1은 리사이즈/이동 가능·always-on-top 아님을 요구할 뿐 최소 크기는 정하지
    // 않는다 — resizable/movable=true, alwaysOnTop=false는 Electron 기본값이라 이미 충족되지만
    // 최소 크기는 비어 있었다. minWidth는 검증된 유일한 폭(420, P1.7/P3.3/P4.3 텍스트 오버플로
    // 수정이 전부 이 폭 "안에서" 일어남 — 420 미만은 실제로 깨지는지 확인된 적이 없어 보수적
    // 하한으로만 씀)으로 둔다. minHeight는 처음 360으로 뒀다가 critical-reviewer 지적으로 실측:
    // .sidebar는 .app의 기본 align-items:stretch로 창 높이만큼 늘어나는데 5개 메뉴 버튼의
    // 실제 필요 높이(padding+gap 포함)가 약 327px라, 360(프레임 포함 외곽 기준이라 실제
    // 콘텐츠 영역은 더 작음, 실측 시 295px)에서는 사이드바 마지막 메뉴가 창 밖으로 잘렸다.
    // 420이면 콘텐츠 영역이 약 355px로 327px보다 넉넉해 안 잘리는 것을 Playwright로 실측
    // 확인했다 — 폭과 같은 420으로 맞춰 외우기 쉽게 한다.
    // P12.3(critical-reviewer 지적: 이 주석이 갱신 안 돼 있었음): frame:false라 위 "프레임
    // 포함 외곽" 전제는 더 안 맞는다 — minHeight(420) 전체가 콘텐츠 영역이고 그 안에서
    // 타이틀바(36px)가 공간을 나눠 쓴다. 384px(420-36)로 이전(355px)보다 늘었고, Playwright
    // 재실측으로 사이드바 마지막 메뉴 하단이 363px로 안 잘림을 확인(requirements.md B1.1).
    // P15(critical-reviewer 지적, High): 사이드바 메뉴가 5개→6개("설정" 추가)로 늘면서 이
    // 363px 계산의 전제(5개 기준)가 깨졌다 — Playwright 재실측 결과 gap/패딩을 그대로 두면
    // 6번째 메뉴가 창 밖으로 잘리는 정도가 아니라(처음 추정은 6px였지만), 넘친 콘텐츠가
    // 사이드바에 스크롤바를 만들고 그 스크롤바 폭이 버튼 내부 폭을 줄여 4글자 라벨이 두 줄로
    // 줄바꿈되며 오히려 더 크게(약 35px) 넘치는 연쇄 문제였다. index.css의 사이드바
    // gap/버튼 세로 패딩을 줄여 6개 모두 한 줄로 유지되게 고쳤고, 재실측으로 마지막 메뉴
    // 하단이 392px(420 안에 여유 28px)임을 확인했다(requirements.md B1.1 갱신 참고).
    minWidth: MIN_WINDOW_SIZE,
    minHeight: MIN_WINDOW_SIZE,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // P4.2: 메모 화면의 디바운스 자동저장(setTimeout)이 트레이로 숨겨진 동안(B5.1, destroy
      // 아님) Chromium의 백그라운드 타이머 스로틀링에 걸려 지연되지 않도록 끈다. 이 창은 항상
      // 최대 1개뿐이고 숨겨져 있어도 트레이 상주 위젯이라 백그라운드 CPU 비용을 아낄 이유가
      // 없다(critical-reviewer 지적: 꺼두지 않으면 숨긴 채로 오래 두면 대기 중이던 저장이
      // 임의로 늦어질 수 있음).
      backgroundThrottling: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    // P12.1: 기본 애플리케이션 메뉴를 완전히 없애면(아래 app.whenReady 참고) Electron이 메뉴에
    // 묶어 제공하던 새로고침(Ctrl+R)/DevTools(Ctrl+Shift+I) 단축키도 같이 사라진다. dev 모드
    // 한정으로 직접 가로채 개발 편의를 유지한다 — 메뉴 바 자체는 dev/패키지 모두 안 보이는
    // 상태를 유지한다(done_when). critical-reviewer 지적: input.key(KeyboardEvent.key)는
    // 키보드 배열/IME 상태에 따라 달라질 수 있어(예: 한글 입력 모드) input.code(물리적 키,
    // 배열 무관)를 쓴다. isAutoRepeat 가드는 키를 누르고 있을 때 reload/DevTools 토글이
    // 반복 발동하는 것을 막는다. reload()는 대기 중인 메모 디바운스 자동저장(P4.2)을 날릴 수
    // 있지만 dev 전용 편의 기능이라 허용한다.
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown' || input.isAutoRepeat) return;
      const ctrlOrCmd = input.control || input.meta;
      if (!ctrlOrCmd) return;
      if (input.code === 'KeyR') {
        mainWindow.webContents.reload();
        event.preventDefault();
      } else if (input.shift && input.code === 'KeyI') {
        mainWindow.webContents.toggleDevTools();
        event.preventDefault();
      }
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // P7.5 결정(사람, 2026-09-25): resize/move마다 즉시 저장하지 않고 디바운스해 드래그 중
  // 수십 번씩 파일을 쓰지 않는다. 최대화/최소화 상태에서는 getBounds()가 화면을 가득 채운
  // 값이나 비정상 좌표를 줄 수 있어(critical-reviewer 지적, P7.5 리뷰) getNormalBounds()로
  // "일반 상태였다면 가졌을 크기"를 저장하고, 최소화 중에는 저장 자체를 건너뛴다.
  let saveStateTimer = null;
  function captureAndSaveWindowState() {
    if (mainWindow.isDestroyed() || mainWindow.isMinimized()) return;
    saveWindowState(mainWindow.getNormalBounds());
  }
  function scheduleSaveWindowState() {
    if (saveStateTimer) clearTimeout(saveStateTimer);
    saveStateTimer = setTimeout(() => {
      saveStateTimer = null;
      captureAndSaveWindowState();
    }, 500);
  }
  mainWindow.on('resize', scheduleSaveWindowState);
  mainWindow.on('move', scheduleSaveWindowState);

  // B5.1: 닫기(X)는 완전 종료가 아니라 트레이로 숨김 — 프로덕션 동작.
  // DEV_QUIT_ON_CLOSE(run-widget.bat 전용 개발 편의 플래그)가 설정된 경우에만 예외로
  // 닫기를 실제 종료로 취급한다: 개발 중 창을 닫았는데 프로세스가 트레이에 남아있으면
  // 다음 실행 때 포트(5173) 충돌로 이어지는 문제가 있었음. app.isPackaged 가드로 이 예외가
  // 배포 빌드(CLAUDE.md가 잠근 "닫기≠종료" 결정)에 새어들지 못하게 막는다(critical-reviewer
  // 지적: 이 분기가 backlog 어디에도 기록돼 있지 않았음).
  // P7.5: 창 상태 저장은 hide/quit 분기와 무관하게 항상 먼저 실행한다 — 두 close 리스너를
  // 따로 등록해 순서에 의존하면 나중에 리스너 순서가 바뀔 때 조용히 깨질 수 있다(critical-reviewer
  // 지적). 디바운스 타이머가 남아 있으면 취소하고 그 자리에서 바로 저장해, 아직 안 끝난
  // 마지막 변경도 놓치지 않는다(B5.1상 close는 항상 도달하는 유일한 저장 지점 —
  // session-end/before-quit은 발생이 보장되지 않음).
  mainWindow.on('close', (event) => {
    if (saveStateTimer) {
      clearTimeout(saveStateTimer);
      saveStateTimer = null;
    }
    captureAndSaveWindowState();

    if (process.env.DEV_QUIT_ON_CLOSE && !app.isPackaged) {
      app.isQuitting = true;
      app.quit();
      return;
    }
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // B5.2: before-quit은 Windows 종료/로그아웃 시 발생하지 않는다(Electron 문서 명시) —
  // session-end로 그 경로를 따로 잡아 close 핸들러가 종료를 막지 않게 한다. 이 경로는 close를
  // 안 거칠 수 있어(critical-reviewer 지적) 여기서도 창 상태를 저장해 둔다.
  mainWindow.on('session-end', () => {
    app.isQuitting = true;
    captureAndSaveWindowState();
  });

  // P1.6: X닫기는 destroy가 아니라 hide라(B5.1) React 트리가 트레이에 숨어있는 동안도 계속
  // 살아있다 — 다시 보여질 때마다 최신 data.json을 다시 읽도록 렌더러에 신호를 보낸다.
  // 'show'만으로는 최소화(minimize) 후 복원(restore)은 못 잡는다 — Electron에서 그건 별도
  // 'restore' 이벤트로 온다(critical-reviewer 지적: "트레이에 며칠 떠 있을 수 있다"는 이
  // task의 전제가 최소화 상태에도 똑같이 적용됨). isDestroyed() 가드는 렌더러가 아직 없거나
  // 이미 정리된 시점에 이 콜백이 불려도 예외를 던지지 않기 위함 — 그 시점의 초기 로드는 이
  // 신호와 무관하게 useAppData의 마운트 시 load()가 담당한다.
  function notifyDataChanged() {
    if (!mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send('data:changed');
    }
  }
  mainWindow.on('show', notifyDataChanged);
  mainWindow.on('restore', notifyDataChanged);
  // P12.22: 최대화 상태 변화를 렌더러에 알리는 로직(P12.3)은 electron/windowControls.js로 옮겼다.
  forwardMaximizeState(mainWindow);
  // P5.7 critical-reviewer 지적: show/restore만으로는 "창을 띄운 채로 자정을 넘기고 그냥
  // 클릭만 하는" 경우를 못 잡는다 — focus도 같은 신호를 보내 재조회 계기를 넓힌다(정책 자체는
  // 안 바뀜: 렌더러의 Schedule.jsx가 이 신호로 다시 렌더될 때 오늘 날짜가 바뀌었는지 비교해서
  // 바뀐 경우에만 리셋한다).
  mainWindow.on('focus', notifyDataChanged);
}

// P7.1: 저장소에 이미지 처리 라이브러리가 전혀 없어(package.json 확인) 순수 Node(zlib)로
// 만든 32x32 PNG(electron/assets/tray-icon.png, 앱 accent 색 원 + 체크마크)를 로드한다.
// nativeImage.createFromPath는 파일이 없거나 읽기에 실패하면 예외 대신 빈 이미지를 반환하므로
// isEmpty()로 확인해 개발 중 경로 실수를 조용히 넘기지 않는다.
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    console.error('트레이 아이콘을 불러오지 못했습니다:', iconPath);
  }
  tray = new Tray(icon);
  tray.setToolTip('TaskDock');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '열기/숨기기', click: () => (mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()) },
  ]));
  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
}

// P7.2: Windows 로그인 시 자동 실행(work-widget-requirements.md 방향 21행 — "서비스 또는 시작
// 프로그램 등록"). 패키지 빌드에서만 실제로 등록한다 — app.isPackaged가 false인 개발 모드에서
// 그대로 실행하면 개발 중 띄운 electron.exe 경로가 실제 사용자의 Windows 시작 프로그램에
// 등록돼 매 로그인마다 개발용 프로세스가 뜨는 부작용이 생긴다(DEV_QUIT_ON_CLOSE와 같은 이유의
// dev/prod 분리). 최초 1회만 등록하는 이유는 autoLaunch.js 주석 참고(P7.2 결정, critical-reviewer
// 지적 반영 — 매번 강제 재등록하면 사용자가 Windows에서 직접 끈 것도 앱이 되돌려버림).
function configureAutoLaunch() {
  if (!app.isPackaged) return;
  const flagPath = getAutoLaunchFlagPath();
  if (hasRegisteredAutoLaunch(flagPath)) return;
  app.setLoginItemSettings({ openAtLogin: true });
  markAutoLaunchRegistered(flagPath);
}

app.whenReady().then(() => {
  // P12.13: 렌더러 CSS의 :root { color-scheme: dark }만으로는 Windows에서 <select> 드롭다운
  // 팝업이 여전히 밝은 색으로 뜬다(Windows에서는 Chromium이 그 팝업을 OS 네이티브 콤보박스
  // 컨트롤로 그리기 때문에, 페이지 CSS의 color-scheme이 거기까지 안 미친다 — Playwright
  // 스크린샷으로 실측 확인). nativeTheme.themeSource='dark'로 그 팝업도 고쳐보려 시도했지만
  // critical-reviewer 재검증(Playwright 재실측)에서 이 특정 팝업에는 효과가 없는 것으로
  // 확인됐다 — select 팝업 문제의 해결책은 아니다(P12.13이 그 select 3종류를 네이티브
  // <select> 대신 토글 버튼 그룹으로 바꾼 진짜 이유, index.css 참고). 그래도 이 앱은 라이트
  // 테마를 제공하지 않으므로(다크 글래스 단일 테마) 트레이 컨텍스트 메뉴 등 이 설정이 실제로
  // 영향을 주는 다른 OS 네이티브 UI를 위해 'system'이 아닌 'dark'로 고정해 둔다.
  // P13: 이름/아이콘 리브랜딩으로 userData 경로가 바뀌었으니, 창/트레이/자동실행 등 무엇이든
  // userData를 건드리기 전에 옛 폴더("업무 위젯")가 있으면 가장 먼저 옮겨온다.
  migrateLegacyUserData();
  nativeTheme.themeSource = 'dark';
  // P12.1 결정(2026-09-25): 트레이 상주 위젯에는 쓸모없는 Electron 기본 메뉴(File/Edit/
  // View/Window/Help)를 완전히 없앤다 — dev/패키지 모두 동일하게 적용한다(dev 편의 단축키는
  // createWindow의 before-input-event로 별도 유지). 기본 메뉴의 Quit(Ctrl+Q) 항목이 B5.2
  // ("종료 메뉴 없음")를 우회하는 경로였는데, 메뉴 자체가 없으니 이 우회로도 함께 없어진다.
  Menu.setApplicationMenu(null);
  createWindow();
  createTray();
  configureAutoLaunch();
});

// P7.1 critical-reviewer 지적: tray는 모듈 스코프 변수라 바깥에서 실제 Tray 인스턴스를
// 확인할 방법이 없어, 독립적으로 같은 파일을 다시 읽어보는 간접 검증만 가능했다 — Playwright의
// electronApp.evaluate()가 CDP로 주입하는 코드는 모듈 스코프 require를 못 쓰므로(전역이
// 아님), global에 최소한만 노출한다(프로덕션 동작에는 영향 없음, 렌더러는 이 값을 쓰지 않고
// IPC만 씀).
global.__mainProcessTestHooks = {
  getTray: () => tray,
  getMainWindow: () => mainWindow,
  configureAutoLaunch,
  getAutoLaunchFlagPath,
  hasRegisteredAutoLaunch,
};

// B5.2: 별도 종료 메뉴 없음 — OS 종료/로그아웃 시에만 실제 종료
app.on('before-quit', () => {
  app.isQuitting = true;
});

// window-all-closed 리스너는 인자를 받지 않는다(Electron 타입 정의 확인) — event.preventDefault()는
// 항상 TypeError였다. 창은 X로는 hide만 되고 close되지 않으므로 이 이벤트는 실제 종료 시퀀스에서만
// 발생하며, 그때는 기본 동작(비-macOS에서 앱 종료)을 그대로 둬야 한다. 별도 처리 불필요.

ipcMain.handle('data:load', () => loadData());
ipcMain.handle('data:save', (_event, data) => {
  saveData(data);
  return true;
});

// P12.22: TitleBar.jsx(렌더러)의 최소화/최대화/닫기/상태조회 IPC 핸들러(P12.3)는
// electron/windowControls.js로 옮겼다 — mainWindow는 이 파일에서 재할당되는 let 변수라
// getter로 넘긴다.
registerWindowControls(() => mainWindow);
// P14.1: 외부 backlog(.json) 소스 파일 선택+읽기 전용 IPC는 electron/backlogSources.js로
// 분리한다(main.js 300줄 한도, P12.22와 같은 이유). dialog.showOpenDialog가 부모 창을
// 필요로 해 같은 getter 패턴을 재사용한다.
registerBacklogSourceHandlers(() => mainWindow);
