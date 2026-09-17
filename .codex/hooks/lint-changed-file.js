// PostToolUse(Write|Edit) 훅: 방금 편집한 파일 하나만 빠르게 검사 (lint + 코드 길이)
//
// 왜 필요한가: eslint.config.js의 max-lines(300줄) 규칙과 일반 lint 규칙을 편집
// "직후" 바로 알려주기 위함. 프로젝트 전체를 매번 돌리면 느려서(수십~수백 파일),
// 여기서는 방금 바뀐 파일 하나만 검사한다 — 전체 검사는 Stop 훅(stop-full-check.js)
// 이 완료 전에 한 번 더 한다.
//
// 범위: src/**/*.{js,jsx}, electron/**/*.js 만. node_modules/dist/.claude 및
// backlog.json·data.json 같은 데이터/추적 파일은 대상이 아니다(코드가 아님).
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PROJECT_ROOT = 'C:/교육/바이브코딩교육';
const ESLINT_BIN = path.join(PROJECT_ROOT, 'node_modules', 'eslint', 'bin', 'eslint.js');
const INTERNAL_TIMEOUT_MS = 15000; // 바깥 hook timeout(25s)보다 짧게 — 우리가 먼저 판정한다

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
    try {
      require('child_process').execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
    } catch {
      // 이미 종료됐으면 무시
    }
  } else {
    try { child.kill('SIGKILL'); } catch {}
  }
}

function runEslintOnFile(filePath) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [ESLINT_BIN, filePath], {
      cwd: PROJECT_ROOT,
      shell: false,
    });
    let out = '';
    let err = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, INTERNAL_TIMEOUT_MS);

    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        resolve({ status: 'TIMEOUT', code: null, out, err });
      } else {
        resolve({ status: code === 0 ? 'PASS' : 'FAIL', code, out, err });
      }
    });
  });
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

    const filePath = input?.tool_input?.file_path || input?.tool_response?.filePath || '';
    const normalized = filePath.replace(/\\/g, '/');
    const inScope = /\/(src|electron)\/.*\.jsx?$/.test(normalized) && !normalized.includes('/node_modules/');
    if (!inScope) process.exit(0);

    if (!fs.existsSync(filePath)) process.exit(0); // 삭제된 파일은 검사 대상 아님

    const result = await runEslintOnFile(filePath);

    if (result.status === 'PASS') {
      process.exit(0);
    }

    if (result.status === 'TIMEOUT') {
      console.error(
        `[lint 시간 초과 — 미검증] ${filePath} 에 대한 eslint 실행이 ${INTERNAL_TIMEOUT_MS}ms 안에 끝나지 않아 강제 종료했습니다. ` +
        `이 파일은 lint 통과 여부를 확인하지 못한 상태입니다(통과로 간주하지 마세요). ` +
        `수정 방법: 파일 크기/의존성 순환 등 원인을 확인한 뒤 "node node_modules/eslint/bin/eslint.js <파일>" 을 직접 실행해 재현하세요.`
      );
      process.exit(2);
    }

    // FAIL: eslint 자체 출력(파일:줄:컬럼, 규칙명, 메시지)을 그대로 전달 — max-lines 위반도 여기 포함됨
    console.error(`[lint 실패] ${filePath}`);
    console.error(result.out || result.err);
    console.error('수정 방법: 위 규칙(예: max-lines)과 줄 번호를 보고 고친 뒤 다시 저장하세요.');
    process.exit(2);
  } catch (e) {
    console.error(`[lint-changed-file.js 내부 오류, 통과 처리함] ${e && e.stack}`);
    process.exit(0);
  }
})();
