# Backlog 운영 규칙

CLAUDE.md의 "Backlog 기반 작업 실행 순서"(1~9단계)의 상세 규칙이다. 실행 순서 자체는 CLAUDE.md를 따르고, 여기서는 "누가/언제/어떻게"와 "무엇이 실제로 강제되는가"만 다룬다.

이 파일이 세션에 실제로 로드됐는지는 `/context`(로드된 memory/rules 목록) 또는 `/memory`로 확인한다. 이 세션 안에서는 자동 로드 여부를 직접 검증하지 못했으므로, 로드가 확인되지 않아도 CLAUDE.md가 이 경로를 읽으라고 명시적으로 지시하는 것으로 대체한다.

## 1. 백로그 변경 주체

| 주체 | 쓸 수 있는 것 | 방법 / 근거 |
|---|---|---|
| 메인 세션(Claude) | 상태 전이, task 추가, 위치 정리, 메타데이터 필드 교정 | `node scripts/backlog/cli.js set-status` / `add` / `reorder` / `set-field`(P11, status 제외 필드용) 만 사용 |
| `critical-reviewer` 서브에이전트 | 없음 | Write 도구 자체가 없음(`.claude/agents/critical-reviewer.md` frontmatter) |
| `backlog-explainer` 서브에이전트 | `docs/backlog/<id>.md` | Write 도구는 있으나 경로 제한은 프롬프트 지침(도구 수준 강제 아님) |
| 사람이 직접 Edit/Write | 원칙적으로 금지 | 실제 경로(`C:/교육/바이브코딩교육/backlog.json`)에 대한 Read/Grep/Bash 직접 접근은 `block-backlog-direct-read.js`(PreToolUse)가 차단. 그래도 직접 고친 결과물은 `validate-backlog.js`(PostToolUse)가 사후 검증 |

주의: `block-backlog-direct-read.js`는 경로가 정확히 실제 backlog.json과 일치할 때만 차단한다(휴리스틱). `validate-backlog.js`는 파일명이 `backlog.json`이면 경로 무관하게 검증한다(격리된 테스트 사본에도 적용됨).

## 2. 상태 전이

`enums.status` 실측값(CLI `add`의 검증 오류로 확인): `todo, in_progress, in_review, needs_info, blocked, done, cancelled`.

- `todo → in_progress`: 착수 시 `--owner`/`--note`로 실제 착수 사실 기록.
- `in_progress → in_review`: critical-reviewer/backlog-explainer 병렬 실행 구간(§5).
- `in_review → in_progress`: 지적 반영 작업이 남아있을 때.
- `* → needs_info`: 사람의 결정이 필요한 모호함/충돌 발견 시 (§7).
- `* → done`: **CLI가 `--note` 없이는 거부한다** — `scripts/backlog/lib/mutations.js`의 코드 자체 검증(훅 아님). 완료 판단 조건은 §6.
- `* → blocked`: 외부 요인(환경/도구)으로 진행 불가. 원인·재시도 조건을 `--note`에 남긴다.
- `* → cancelled`: 더 이상 진행하지 않기로 확정된 경우만.

`set-status`는 `updated_at`을 자동 갱신하고 `log`에 항목을 append한다 — 수동으로 만들지 않는다. `claimed_at` 필드는 현재 CLI에 전용 설정 명령이 없다: 착수 사실은 `--owner`/`--note`로 남기고, `claimed_at` 자동화가 필요하면 스키마/CLI 확장을 사람에게 확인받는다(추측으로 채우지 않는다).

## 3. 코드 책임 분리 (`eslint.config.js` 기준)

- `src/**/*.{js,jsx}` — 렌더러(React). browser 전역, max-lines 300.
- `electron/**/*.js` — 메인 프로세스. node 전역, max-lines 300.
- `scripts/backlog/**` — backlog CLI/lib. 스키마 검증 로직의 단일 소스(훅도 이 lib를 그대로 import — 로직 이원화 금지).
- `tools/backlog-dashboard.html` — 개발용 backlog 열람 도구. 제품 화면(`src/screens/*.jsx`, B1~B5)과 별개이며 위젯 기능(B-스펙)으로 편입하지 않는다.
- `docs/backlog/*.md` — backlog-explainer 산출물. 스냅샷 기준 전량 재생성 파일이라 손으로 고치지 않는다(지침) — 내용을 바꾸려면 backlog.json을 고치고 backlog-explainer를 다시 돌린다.
- `.claude/`, `.codex/` — Claude Code / Codex 두 런타임용 훅·에이전트 설정 쌍. 한쪽만 고치면 어긋나므로 항상 같이 수정한다. 둘 다 `eslint.config.js`의 lint 대상에서 제외.

## 4. 문서·대시보드 갱신 시점

- backlog.json의 `status`/`log`/`done_when`/`deps`/`parent` 등이 바뀔 때마다가 아니라, 여러 task를 정리한 뒤 **배치 단위**로 backlog-explainer를 재실행해 `docs/backlog/`를 스냅샷 전체 기준으로 재생성한다(에이전트가 "스냅샷의 모든 id를 전량 순회"하도록 설계돼 있어 부분 갱신을 지원하지 않음).
- `tools/backlog-dashboard.html`은 상태를 저장하지 않고 매번 파일을 다시 선택해서 보는 구조라 별도 "갱신" 작업이 없다 — 최신 상태를 보려면 파일 재선택.

## 5. 동시 실행 중 입력 고정

- critical-reviewer/backlog-explainer를 병렬 실행하는 동안(CLAUDE.md 5단계) 메인 세션은 `set-status`/`add`/`reorder`/`set-field` 등 CLI 변경 명령으로 backlog.json을 바꾸지 않는다 — 두 에이전트가 같은 `_source.sha256` 스냅샷을 기준으로 서로 다른 관점을 내는 것이 설계 의도이므로, 중간에 스냅샷이 바뀌면 두 결과가 서로 다른 버전을 검토한 셈이 된다.
- backlog.json 갱신은 메인 세션만 한다(§1) — 두 서브에이전트 결과를 받은 뒤 메인 세션이 반영한다.

## 6. 완료 근거로 인정하지 않는 것

다음 중 하나라도 해당하면 `done`으로 기록하지 않는다:

- 그 task의 최신 스냅샷에 대해 critical-reviewer를 아직 실행하지 않음(리뷰 미실행)
- 관련 훅이 실패(exit 2)했거나 **TIMEOUT/미검증**으로 끝남 — `lint-changed-file.js`/`stop-full-check.js`는 미검증을 FAIL과 구분해서 보고하며, 미검증을 통과로 간주하지 않는다(검사 실패/미설정 검사)
- `done_when`이 사실상 자동 검증을 요구하는데 `gate`가 비어 있어 아무도 실행·확인하지 않은 상태(미설정 검사)

해당하면 `needs_info` 또는 `blocked`로 남기고 `--note`에 무엇이 왜 안 됐는지 적는다.

## 7. 사람 판단이 필요할 때

모호한 요구사항, 상충하는 지시, 스키마에 없는 필드 처리(예: `claimed_at` 자동화, `evidence` 필드 도입) 등은 임의로 결정하지 않는다. `set-status <id> needs_info --note="<구체적 질문>"`으로 남기고, 사람/다음 세션이 답할 때까지 그 task는 진행하지 않는다.

## 8. 규칙 유형 분류

| 규칙 | 유형 | 근거 |
|---|---|---|
| backlog.json 직접 Read/Grep/Bash 금지 | **hook 검사** | `.claude/hooks/block-backlog-direct-read.js` (PreToolUse) |
| backlog.json 구조·참조 무결성(중복 id, deps/parent 존재성, 순환) | **hook 검사** | `.claude/hooks/validate-backlog.js` (PostToolUse, `scripts/backlog/lib` 공유) |
| `done` 전이 시 `--note` 필수 | **CLI 자체 검증**(훅 아님) | `scripts/backlog/lib/mutations.js` |
| `set-field`로 필드 교정 시 `--note` 필수, 허용 필드 화이트리스트(status/id/log/updated_at/done_at/claimed_at 제외) | **CLI 자체 검증**(훅 아님) | `scripts/backlog/lib/mutations.js`(`setField`, P11) |
| src/electron에서 알림 API 사용 시 경고 | **hook 검사**(비차단 경고) | `.claude/hooks/check-no-notifications.js` |
| 변경 파일 lint 통과 + 300줄 제한 | **hook 검사** | `.claude/hooks/lint-changed-file.js` (PostToolUse) |
| 전체 lint + vite build + electron 문법 검사 | **hook 검사** | `.claude/hooks/stop-full-check.js` (Stop) |
| gate 필드를 읽어서 실행하지 않음 | **hook 검사 + 지침** | 위 모든 훅과 두 에이전트 프롬프트가 동일하게 명시 — gate는 표시/참고용 |
| critical-reviewer 근거 있는 지적 반영 후 done | **리뷰로 확인** | `.claude/agents/critical-reviewer.md` — 강제하는 훅 없음, 이 문서 §6이 지침으로 요구 |
| docs/backlog 손 편집 금지, 배치 재생성 | **지침** | 강제하는 훅 없음 |
| 병렬 실행 중 backlog.json 입력 고정 | **지침** | 강제하는 훅 없음 — 메인 세션이 스스로 지킨다 |
| backlog.json은 메인 세션만 갱신 | **지침**(+ 사후 hook 검증) | 쓰기 권한 제한 자체는 지침(§1); 실제로 잘못 쓰였을 때 무결성은 `validate-backlog.js`가 사후에 잡는다 |
