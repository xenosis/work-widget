const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');

module.exports = defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  // src/lib 순수함수 + electron/dataStore.js의 fs 기반 순수 로직(백업 정리 등, P7.3)만
  // 대상으로 한다. dataStore.js가 최상단에서 require('electron')을 하지만, vitest(plain node)
  // 환경에서는 그 모듈이 실행 파일 경로 문자열을 내보내 `app`이 undefined가 될 뿐 require
  // 자체는 에러 없이 통과한다 — `app.getPath`를 실제로 호출하는 함수(getBackupDir 등)는
  // 여기서 테스트하지 않고, dir을 인자로 받는 순수 함수(pruneOldBackups 등)만 검증한다.
  // P11 결정(사람, 2026-09-25): scripts/backlog(CJS/node 전역)를 "예방적으로 제외"하던 기존
  // 한정을 풀었다 — critical-reviewer가 setField/findParentCycle 같은 순수 검증 로직이
  // 수동 CLI 시나리오로만 확인되고 회귀 테스트가 없다고 지적했고, Electron/screen 같은 외부
  // 런타임 의존이 없어 electron/dataStore.js와 같은 이유로 안전하게 테스트 가능하다.
  test: {
    include: ['src/**/*.test.js', 'electron/**/*.test.js', 'scripts/**/*.test.js'],
  },
});
