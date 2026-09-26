// B1.3 사이드바 + 화면 헤더에서 쓰는 stroke 기반 아이콘. currentColor를 써서 부모 요소의
// color(활성/비활성 상태)를 그대로 물려받는다 — 아이콘별로 색을 따로 지정하지 않는다.
const SVG_PROPS = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function DashboardIcon(props) {
  return (
    <svg {...SVG_PROPS} {...props}>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="8" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
      <rect x="13" y="13" width="8" height="8" rx="2" />
    </svg>
  );
}

export function ProjectIcon(props) {
  return (
    <svg {...SVG_PROPS} {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  );
}

export function TodoIcon(props) {
  return (
    <svg {...SVG_PROPS} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M8 12l3 3 5-6" />
    </svg>
  );
}

export function MemoIcon(props) {
  return (
    <svg {...SVG_PROPS} {...props}>
      <path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v5h5" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  );
}

export function ScheduleIcon(props) {
  return (
    <svg {...SVG_PROPS} {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </svg>
  );
}

// P12.3: 커스텀 타이틀바(frame:false)의 최소화/최대화/복원/닫기 버튼 — 다른 아이콘과 달리
// 아주 작게(14px 안팎) 쓰이므로 strokeWidth를 조금 더 두껍게(2) 잡아 축소해도 선이 흐려지지
// 않게 한다.
const TITLEBAR_SVG_PROPS = { ...SVG_PROPS, strokeWidth: 2, 'aria-hidden': 'true' };

export function MinimizeIcon(props) {
  return (
    <svg {...TITLEBAR_SVG_PROPS} {...props}>
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function MaximizeIcon(props) {
  return (
    <svg {...TITLEBAR_SVG_PROPS} {...props}>
      <rect x="5" y="5" width="14" height="14" rx="1.5" />
    </svg>
  );
}

// 최대화 상태에서 다시 누르면 이전 크기로 — 네이티브 창의 "복원" 아이콘(겹친 사각형)과 같은
// 관례를 따른다.
export function RestoreIcon(props) {
  return (
    <svg {...TITLEBAR_SVG_PROPS} {...props}>
      <rect x="8" y="5" width="11" height="11" rx="1.5" />
      <path d="M5 8v11a1 1 0 0 0 1 1h11" />
    </svg>
  );
}

export function CloseIcon(props) {
  return (
    <svg {...TITLEBAR_SVG_PROPS} {...props}>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}
