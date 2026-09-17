// PostToolUse(Write|Edit) 훅: 데스크톱 알림 API 사용 경고(비차단)
//
// 왜 필요한가: CLAUDE.md(프로젝트) 잠긴 결정 — "No desktop notifications: due/upcoming
// items surface only in the in-widget dashboard, not OS notifications."
// src/ 또는 electron/ 아래 .js/.jsx 파일에서 Notification API 호출이 보이면 알려준다.
//
// 왜 차단이 아니라 경고인가: 문자열 매칭이라 주석/문자열 리터럴/다른 의미의 동명
// 식별자에서도 걸릴 수 있고(오탐 가능), 요구사항이 바뀌었을 수도 있다 — 최종 판단은
// 사람이 한다.
const fs = require('fs');

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
    setTimeout(() => resolve(data), 5000);
  });
}

function warn(message) {
  process.stdout.write(JSON.stringify({ systemMessage: message }));
}

(async () => {
  try {
    const raw = await readStdin();
    let input;
    try {
      input = JSON.parse(raw || '{}');
    } catch {
      process.exit(0);
    }

    const filePath =
      input?.tool_input?.file_path || input?.tool_response?.filePath || '';
    const normalized = filePath.replace(/\\/g, '/');
    const inScope = /\/(src|electron)\/.*\.(jsx?|tsx?)$/.test(normalized);
    if (!inScope) process.exit(0);

    let text;
    try {
      text = fs.readFileSync(filePath, 'utf-8');
    } catch {
      process.exit(0);
    }

    const patterns = [
      /\bnew\s+Notification\s*\(/,
      /Notification\.requestPermission\s*\(/,
      /\.showNotification\s*\(/,
    ];
    const hit = patterns.some((re) => re.test(text));

    if (hit) {
      warn(
        `[경고] ${filePath} 에서 데스크톱 알림 API 사용이 감지되었습니다. ` +
        `프로젝트 CLAUDE.md 잠긴 결정: "No desktop notifications" — 마감/일정 알림은 ` +
        `대시보드 화면 안에서만 노출해야 합니다. 의도한 변경이 맞는지 확인하세요.`
      );
    }
    process.exit(0);
  } catch (e) {
    console.error(`[check-no-notifications.js 내부 오류, 통과 처리함] ${e && e.stack}`);
    process.exit(0);
  }
})();
