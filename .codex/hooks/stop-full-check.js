// Stop 훅: 세션을 끝내기 전 전체 검증 (전체 lint + 렌더러 build + src/lib 테스트 + electron
// 메인프로세스 문법 검사)
//
// 이 프로젝트는 electron/*.js(메인 프로세스)에 대한 별도 컴파일/번들 단계가 없다
// (package.json build 스크립트는 "vite build"뿐이고, 이건 src/ 렌더러만 번들한다).
// electron/*.js는 Node가 그대로 실행하므로, 이 스택에서 실제로 가능한 "빌드 검증"은
// 다음을 합친 것이다:
//   1) 렌더러: `vite build`가 실제로 성공하는지 (번들/변환 오류 검출)
//   2) src/lib: `vitest run`으로 회귀 테스트 실행 (P6.5부터 — vitest 미설치 시 이 단계는 건너뜀)
//   3) 메인 프로세스: `node --check`로 문법 오류만 검출 (실행/번들은 하지 않음 —
//      이 스택엔 그 단계 자체가 없다. 이걸 build 성공으로 위장하지 않고 별도 항목으로 보고한다)
//
// stop_hook_active 처리 정책:
//   - 처음 실패를 발견하면: exit 2로 차단하고 구체적 수정 안내를 stderr로 준다 (재작업 요청)
//   - stop_hook_active === true (이미 한 번 막았는데 또 실패)면: 무한 루프를 막기 위해
//     더 이상 막지 않고 exit 0으로 종료를 허용한다. 단, "통과했다"고 절대 말하지 않고
//     남은 실패 목록을 loud하게 보고한다 — 재진입이라는 이유로 미통과를 완료 처리하지 않는다.
//
// 타임아웃 정책: 각 내부 검사마다 별도 타임아웃을 걸고, 시간 초과는 FAIL이 아니라
// TIMEOUT(미검증)으로 따로 표시한다 — 이 hook의 바깥 timeout(settings.json)이 끝까지
// 기다려주거나 프로세스 트리를 확실히 정리해줄 거라고 가정하지 않는다(특히 Windows에서
// npm/vite가 자식 프로세스를 더 낳는 경우, 부모만 죽이면 트리가 남을 수 있어서
// taskkill /T /F로 트리 전체를 정리한다).
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const PROJECT_ROOT = 'C:/교육/바이브코딩교육';
const ESLINT_BIN = path.join(PROJECT_ROOT, 'node_modules', 'eslint', 'bin', 'eslint.js');
const VITE_BIN = path.join(PROJECT_ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const VITEST_BIN = path.join(PROJECT_ROOT, 'node_modules', 'vitest', 'vitest.mjs');
const ELECTRON_MAIN_FILES = ['electron/dataStore.js', 'electron/main.js', 'electron/preload.js'];

const TIMEOUT_LINT_MS = 60000;
const TIMEOUT_BUILD_MS = 90000;
const TIMEOUT_TEST_MS = 60000;
const TIMEOUT_SYNTAX_MS = 5000; // 파일당

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
    setTimeout(() => resolve(data), 5000);
  });
}

function killTree(child) {
  if (process.platform === 'win32' && child.pid) {
    try { execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' }); } catch {}
  } else {
    try { child.kill('SIGKILL'); } catch {}
  }
}

function runWithTimeout(cmd, args, timeoutMs, cwd) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: cwd || PROJECT_ROOT, shell: false });
    let out = '';
    let err = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, timeoutMs);

    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) resolve({ status: 'TIMEOUT', out, err });
      else resolve({ status: code === 0 ? 'PASS' : 'FAIL', code, out, err });
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ status: 'FAIL', code: null, out, err: String(e) });
    });
  });
}

(async () => {
  const raw = await readStdin();
  let input = {};
  try { input = JSON.parse(raw || '{}'); } catch {}
  const stopHookActive = input?.stop_hook_active === true;

  const results = [];

  // 1) 전체 lint (max-lines 포함, eslint.config.js 기준)
  const lint = await runWithTimeout(process.execPath, [ESLINT_BIN, '.'], TIMEOUT_LINT_MS);
  results.push({ name: 'lint (eslint .)', ...lint });

  // 2) 렌더러 build
  const build = await runWithTimeout(process.execPath, [VITE_BIN, 'build'], TIMEOUT_BUILD_MS);
  results.push({ name: 'build (vite build)', ...build });

  // 3) src/lib 회귀 테스트 (P6.5)
  if (fs.existsSync(VITEST_BIN)) {
    const test = await runWithTimeout(process.execPath, [VITEST_BIN, 'run'], TIMEOUT_TEST_MS);
    results.push({ name: 'test (vitest run)', ...test });
  }

  // 4) electron 메인 프로세스 문법 검사 (이 스택엔 별도 컴파일 단계가 없어 문법 검사로 대체)
  for (const f of ELECTRON_MAIN_FILES) {
    const full = path.join(PROJECT_ROOT, f);
    if (!fs.existsSync(full)) continue;
    const r = await runWithTimeout(process.execPath, ['--check', full], TIMEOUT_SYNTAX_MS);
    results.push({ name: `syntax check (node --check ${f})`, ...r });
  }

  const failures = results.filter((r) => r.status !== 'PASS');

  if (failures.length === 0) {
    process.exit(0); // 전부 통과 — 조용히 종료 허용
  }

  const report = failures.map((r) => {
    if (r.status === 'TIMEOUT') {
      return `- [${r.name}] TIMEOUT — 시간 내 끝나지 않아 강제 종료함. 통과/실패 어느 쪽도 아닌 "미검증" 상태입니다.`;
    }
    const detail = (r.out || r.err || '').trim().split('\n').slice(0, 30).join('\n');
    return `- [${r.name}] FAIL (exit ${r.code})\n${detail}`;
  }).join('\n\n');

  if (!stopHookActive) {
    console.error('[전체 검증 실패 — 완료 보류] 다음 항목을 고친 뒤 다시 시도하세요:\n');
    console.error(report);
    process.exit(2);
  }

  // stop_hook_active === true: 이미 한 번 막았다. 무한 루프 방지를 위해 더 막지는 않되,
  // "통과"로 오인되지 않도록 실패 내용을 명확히 남긴다.
  console.error(
    '[경고: 미해결 상태로 세션 종료 허용] Stop 훅이 이미 한 번 재작업을 요청했는데도 아래 검증이 ' +
    '여전히 실패/미검증 상태입니다. 무한 반복을 막기 위해 이번엔 종료를 막지 않지만, 이 작업은 ' +
    '완료된 것이 아닙니다 — 다음 세션에서 반드시 이어서 고쳐야 합니다:\n'
  );
  console.error(report);
  process.exit(0);
})();
