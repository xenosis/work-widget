const js = require('@eslint/js');
const globals = require('globals');
const reactHooks = require('eslint-plugin-react-hooks');
const reactRefresh = require('eslint-plugin-react-refresh').default;

// 코드 길이 기준(300줄)에 대한 근거는 backlog.json 및 세션 기록 참고:
// 현재 가장 긴 소스 파일(electron/main.js)이 65줄이고 나머지는 대부분 30줄 이하인
// 매우 초기 단계 코드베이스라서, 300은 "지금 걸리는 게 목적"이 아니라 화면 컴포넌트가
// 목록+상세+폼+API 호출을 한 파일에 다 몰아넣기 시작할 때(B2.1 프로젝트 화면처럼
// 목록/상세/인라인 추가가 한 컴포넌트에 뭉치기 쉬운 지점) 그 전에 분리를 강제하기
// 위한 상한선이다. node_modules(의존성), dist/(빌드 산출물), backlog.json·data.json·
// json.json(데이터/추적 파일)은 코드가 아니므로 대상에서 제외한다.
const MAX_LINES = 300;

module.exports = [
  {
    ignores: ['node_modules/**', 'dist/**', 'release/**', '.claude/**', '.codex/**'],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: { ...globals.browser },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'max-lines': ['error', { max: MAX_LINES, skipBlankLines: false, skipComments: false }],
    },
  },
  {
    files: ['electron/**/*.js', 'scripts/**/*.js', 'tools/**/*.js', 'vite.config.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'max-lines': ['error', { max: MAX_LINES, skipBlankLines: false, skipComments: false }],
    },
  },
  {
    // P7.3/P11: vitest 패키지 자체가 require()로 불러오면 에러를 내서(ESM 전용) 이 파일들만
    // import 문법을 쓴다 — electron/*.js, scripts/backlog/*.js 나머지는 여전히
    // commonjs(main 프로세스·CLI 관행).
    files: ['electron/**/*.test.js', 'scripts/**/*.test.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  {
    // P14.1(critical-reviewer 지적, Medium): "위젯이 등록된 외부 backlog(.json) 경로에
    // 절대 쓰지 않는다"는 done_when 조건이 grep/눈으로 확인하는 것 말고는 강제되지 않았다 —
    // 이후 누군가 실수로 fs 쓰기 API를 이 파일들에 추가해도 lint가 잡도록 명시적으로 금지한다.
    // (electron/dataStore.js 등 이 위젯 자신의 data.json/백업에 쓰는 다른 파일들은 대상이
    // 아니다 — 그건 정상 동작이다.)
    files: ['electron/backlogSourceReader.js', 'electron/backlogSources.js'],
    rules: {
      'no-restricted-properties': [
        'error',
        ...['writeFile', 'writeFileSync', 'appendFile', 'appendFileSync', 'rename', 'renameSync', 'unlink', 'unlinkSync', 'rm', 'rmSync', 'rmdir', 'rmdirSync', 'mkdir', 'mkdirSync', 'copyFile', 'copyFileSync', 'truncate', 'truncateSync', 'chmod', 'chmodSync', 'chown', 'chownSync', 'symlink', 'symlinkSync', 'link', 'linkSync', 'utimes', 'utimesSync', 'createWriteStream'].map(
          (property) => ({
            object: 'fs',
            property,
            message: 'P14.1: 외부 backlog(.json) 소스는 읽기 전용이어야 한다 — 이 경로에 쓰기 금지.',
          })
        ),
      ],
    },
  },
];
