// PostToolUse(Write|Edit) 훅: backlog.json 구조 무결성 검사
//
// 검증 로직은 scripts/backlog/lib.js 로 옮겨서 CLI(scripts/backlog/cli.js)와 공유한다
// (같은 검사를 두 곳에 따로 구현하면 시간이 지나며 서로 어긋날 수 있어서 하나로 합쳤다).
//
// 왜 필요한가: 전역 CLAUDE.md 규칙 때문에 모든 새 세션이 시작할 때 backlog.json을
// 읽어서 status/log/deps로 진행상황을 판단한다. 이 파일이 문법 오류나 스키마 위반으로
// 깨지면 이후 모든 세션이 잘못된 진행상황을 전제로 작업을 시작하게 된다.
//
// gate 필드는 여기서도 읽지도, 실행하지도 않는다 — lib.js의 validateSchema는 gate 값을
// 아예 참조하지 않는다.
const path = require('path');
const lib = require('../../scripts/backlog/lib');

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
    setTimeout(() => resolve(data), 5000);
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
    if (path.basename(filePath) !== 'backlog.json') {
      process.exit(0);
    }

    let file;
    try {
      file = lib.readBacklogFile(filePath);
    } catch (e) {
      if (e instanceof lib.BacklogError && e.code === 'IO_ERROR') process.exit(0); // 삭제됨 등
      if (e instanceof lib.BacklogError && e.code === 'PARSE_ERROR') {
        console.error(`[backlog.json 검증 실패] ${e.message}`);
        console.error('수정 방법: 방금 편집한 부분의 문법 오류(쉼표/따옴표/괄호 누락)를 확인하세요.');
        process.exit(2);
      }
      throw e;
    }

    const errors = lib.validateSchema(file.json);
    const cyc = lib.findCycle(file.json.tasks || []);
    if (cyc) errors.push(`deps 순환 의존성: ${cyc.join(' -> ')}`);

    if (errors.length) {
      console.error('[backlog.json 검증 실패] 다음 문제를 고친 뒤 다시 저장하세요:');
      for (const e of errors) console.error(' - ' + e);
      process.exit(2);
    }

    process.exit(0);
  } catch (e) {
    console.error(`[validate-backlog.js 내부 오류, 통과 처리함] ${e && e.stack}`);
    process.exit(0);
  }
})();
