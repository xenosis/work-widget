// scripts/backlog/lib 진입점 — cli.js와 .claude/hooks/validate-backlog.js가
// require('.../lib')로 불러 쓰는 단일 인터페이스. 실제 구현은 책임별로 나뉜 파일에 있다:
//   schema.js    스키마 검증 + deps 순환 검사
//   store.js     파일 읽기/해시/원자적 쓰기/낙관적 동시성
//   queries.js   읽기 전용 조회(list/show/ready/ids)
//   mutations.js 변경 명령(add/set-status)
'use strict';

const schema = require('./schema');
const store = require('./store');
const queries = require('./queries');
const mutations = require('./mutations');

module.exports = {
  ...schema,
  ...store,
  ...queries,
  ...mutations,
};
