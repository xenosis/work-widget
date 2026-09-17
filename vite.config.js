const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');

module.exports = defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  // src/lib 순수함수 테스트만 대상으로 한다 — scripts/backlog(CJS/node 전역)처럼 다른 환경을
  // 가정하는 코드에 나중에 테스트가 생겨도 이 러너와 섞이지 않도록 예방적으로 한정.
  test: {
    include: ['src/**/*.test.js'],
  },
});
