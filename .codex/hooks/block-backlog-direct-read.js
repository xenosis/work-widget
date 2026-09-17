// PreToolUse(Read|Grep|Bash) 훅: backlog.json 직접 읽기 차단
//
// 목적: scripts/backlog/cli.js (list/show/ready/ids)가 검증됐으니, 이제 Claude가
// backlog.json을 Read/Grep/Bash로 직접 열어서 스스로 파싱하지 말고 CLI를 거치게 한다.
// CLI를 거치면 스키마 검증·해시(버전) 정보가 항상 함께 나오기 때문.
//
// 적용 범위(중요 — 과장하지 않는다):
//   - Read 도구: file_path가 대상 backlog.json과 정확히 같은 경로(절대/상대 정규화 후)일 때만 차단.
//   - Grep 도구: path가 지정되어 있고 그 경로가 대상 backlog.json과 정확히 같을 때만 차단.
//     path가 없거나(=현재 디렉터리 전체 검색) 디렉터리를 가리키면 차단하지 않는다
//     (여러 파일을 넓게 검색하는 건 "직접 읽기 시도"로 보지 않는다 — 일반 문서 검색을 막지 않기 위함).
//   - Bash 도구: 명령 문자열에서 "backlog.json"을 대상으로 하는 흔한 직접 읽기 패턴만
//     정규식으로 잡는다(cat/type/more/less/head/tail/Get-Content/gc/Select-String/findstr,
//     리다이렉션 `< backlog.json`, node/python 인라인 스크립트의 파일 읽기 호출 등).
//     ** 이건 휴리스틱이다. 임의의 다른 우회 방법(예: 다른 이름으로 복사 후 읽기,
//     생소한 도구 사용 등)까지 전부 막는다고 보장하지 않는다. **
//   - Glob 도구는 차단 대상이 아니다 — 파일 내용이 아니라 파일명만 나열하므로 범위 밖으로 뒀다.
//
// 대상 경로는 환경변수 BACKLOG_GUARD_TARGET으로 재정의할 수 있다(테스트 시 격리된
// 사본을 가리키기 위함). 지정하지 않으면 실제 프로젝트 backlog.json을 보호한다.
'use strict';

const path = require('path');

const REAL_TARGET = 'C:/교육/바이브코딩교육/backlog.json';
const TARGET = path.resolve(process.env.BACKLOG_GUARD_TARGET || REAL_TARGET);

const CLI_HINT = `대신 조회 CLI를 쓰세요 (읽기 전용, 항상 스키마검증+버전해시 포함):
  node scripts/backlog/cli.js list [--status=todo] [--priority=P0] [--category=feature] [--parent=P0]
  node scripts/backlog/cli.js show <id>
  node scripts/backlog/cli.js ready
  node scripts/backlog/cli.js ids
CLI가 없거나 실패하면(예: node 실행 오류) 이 메시지를 사용자에게 보고하고 우회해서 파일을
직접 열지 마세요 — 오류와 복구 방법(예: node 설치 확인, 경로 확인)을 안내하세요.`;

// Bash에서 흔한 "직접 읽기" 패턴만 — 전체 우회 차단을 보장하지 않는 휴리스틱.
const BASH_READ_PATTERNS = [
  /\b(cat|more|less|head|tail|type|strings|xxd|hexdump)\b[^\n]*backlog\.json/i,
  /\b(gc|Get-Content)\b[^\n]*backlog\.json/i,
  /\b(Select-String|findstr|awk|sed)\b[^\n]*backlog\.json/i,
  /<\s*['"]?[^\s'"]*backlog\.json/i, // 리다이렉션으로 읽기
  /backlog\.json[^\n]*\|\s*(cat|more|less|head|tail)\b/i,
  /readFileSync\([^)]*backlog\.json/i,
  /\.readFile\([^)]*backlog\.json/i,
  /open\([^)]*backlog\.json/i, // python open(...)
];

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
    setTimeout(() => resolve(data), 5000);
  });
}

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

function allow() {
  process.exit(0);
}

(async () => {
  try {
    const raw = await readStdin();
    let input;
    try {
      input = JSON.parse(raw || '{}');
    } catch {
      allow(); // 입력을 못 읽으면 막지 않는다(훅 버그로 정상 작업을 막지 않음)
      return;
    }

    const toolName = input?.tool_name || '';

    if (toolName === 'Read') {
      const fp = input?.tool_input?.file_path;
      if (fp && path.resolve(fp) === TARGET) {
        deny(
          `backlog.json 직접 읽기는 차단됩니다(경로: ${TARGET}). ${CLI_HINT}`
        );
        return;
      }
      allow();
      return;
    }

    if (toolName === 'Grep') {
      const p = input?.tool_input?.path;
      if (p && path.resolve(p) === TARGET) {
        deny(
          `backlog.json 대상 검색은 차단됩니다(경로: ${TARGET}). ${CLI_HINT}`
        );
        return;
      }
      allow(); // path 없음(전체 검색) 또는 디렉터리 대상 검색은 허용
      return;
    }

    if (toolName === 'Bash') {
      const cmd = String(input?.tool_input?.command || '');
      const hit = BASH_READ_PATTERNS.some((re) => re.test(cmd));
      if (hit) {
        deny(
          `Bash로 backlog.json을 직접 읽는 것으로 보이는 명령이 차단됐습니다. ` +
          `이 훅은 cat/type/Get-Content 등 흔한 직접 읽기 패턴만 잡는 휴리스틱이며, ` +
          `모든 우회 방법을 막는다고 보장하지 않습니다. ${CLI_HINT}`
        );
        return;
      }
      allow();
      return;
    }

    allow();
  } catch (e) {
    console.error(`[block-backlog-direct-read.js 내부 오류, 통과 처리함] ${e && e.stack}`);
    allow();
  }
})();
