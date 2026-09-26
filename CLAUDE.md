# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Scaffolding is in place and under active development via the backlog (see below). Actual commands:
- `npm run dev` — Vite dev server + Electron together
- `npm run build` — renderer production build (`vite build`)
- `npm run dist` — build + `electron-builder` packaging
- `npm run lint` — `eslint .`
- `npm test` — `vitest run`, covers `src/lib/*.js` pure functions (added in P6.5; DOM/screen tests are out of scope until a jsdom-like environment is added)

## What this project is

A Windows tray-resident desktop widget (single user, no sync) for managing projects, todos, memos, and a calendar/routine schedule in one place. Full spec lives in `work-widget-requirements.md`: Part A is direction/scope, Part B is the detailed spec (B1–B2 UI flows, B3 data schema, B4 behavior, B5 widget lifecycle).

## Architecture decisions already locked in the requirements

- **Stack**: Electron (React/JS), packaged with `electron-builder`; auto-registered as a Windows startup item.
- **Storage**: local-only, no cloud/server sync. A single `data.json` holds six arrays — `projects`, `todos`, `memos`, `schedules`, `schedule_categories` (added P12.16), `backlog_sources` (added P14.1 — registered *paths* to other projects' backlog(.json) files, read-only; the widget never writes to those external files, see requirements B3.5) (see requirements B3 for field-level schema). Splitting into per-entity files is an accepted future migration if the single file grows too large.
- **Derived vs. stored fields**: `Project.progress` is never persisted — it's computed at read time from the completion ratio of that project's todos.
- **Recurring schedules**: a recurring schedule is one rule record (with `recurrence_days`), not one record per occurrence. Editing a recurring schedule updates the rule and applies to all future occurrences; per-occurrence exceptions are out of scope.
- **Project status auto-transitions**: all todos complete → project auto-flips to "완료"; unchecking a todo or adding a new one to a completed project flips it back to "진행중" automatically. "보류" is only ever set manually, never automatic.
- **No desktop notifications**: due/upcoming items surface only in the in-widget dashboard, not OS notifications.
- **Window close (X) ≠ quit**: closing hides to tray; there is no in-app quit — the process only ends on Windows shutdown/logout.
- **Backup**: periodic local backup of `data.json` is required; exact frequency/retention count is left to implementation (requirements call out daily/keep-recent as the default assumption, not final).

Anything not covered above (exact UI pixel behavior, backup cadence, etc.) should be resolved by reading the relevant B-section in `work-widget-requirements.md` rather than guessed.

## 스택 관련 참고 스킬

이 저장소 작업 시 아래 스킬이 관련 있는 코드를 다룰 때 자동으로 트리거되도록 전역 설치돼 있다(`npx skills add ... -g`, Claude Code에 symlink됨). 해당 영역을 건드릴 땐 추측으로 구현하지 말고 먼저 Skill 도구로 불러와 지침을 확인한다.

| 스킬 | 언제 쓰나 |
|---|---|
| `vite` | `vite.config.js` 수정, 빌드/플러그인/SSR 이슈 다룰 때 |
| `vercel-react-best-practices` | `src/**/*.jsx` 렌더러 컴포넌트 작성/리뷰/리팩터링, 성능 최적화 |
| `electron-development` | `electron/**/*.js` 메인 프로세스, IPC(`P1.5`/`P2.5`/`P4.2` 등 IPC 연동 작업), 트레이/윈도우/보안 관련 작업 |

새로 필요한 영역(예: 캘린더 라이브러리 — `P5.1`)이 생기면 `find-skills` 스킬로 다시 찾아보고 이 표에 추가한다.

## Backlog 기반 작업 실행 순서

상세 규칙(변경 주체, 상태 전이, 코드 책임 분리, 문서 갱신 조건, 강제 방식 분류)은 `.claude/rules/backlog-workflow.md` 참고 — 여기서는 순서만 정리한다. 이 파일이 세션에 실제 로드됐는지는 `/context`로 확인할 수 있다(확인이 안 되더라도 아래 순서는 이 CLAUDE.md 자체가 로드되므로 그대로 따른다).

1. **기준 확인**: `work-widget-requirements.md`로 요구사항을, `node scripts/backlog/cli.js list|show|ready|ids`로 backlog를 조회한다 — backlog.json을 Read/Grep/Bash로 직접 열지 않는다(PreToolUse 훅 `block-backlog-direct-read.js`가 차단). 이 CLAUDE.md와 `.claude/rules/*.md`를 함께 확인한다.
2. **작업 선택**: `cli.js ready`로 deps가 모두 done인 todo 후보를 뽑고, `gate`(있으면 표시만 — 절대 실행하지 않음)와 `done_when`이 실제로 검증 가능한 기준인지 확인한 뒤 작은 단위를 고른다.
3. **착수 기록**: `cli.js set-status <id> in_progress --owner=<식별자> --note=<착수 근거>`로 실제 착수 사실을 backlog.json에 반영한다(추정으로 채우지 않는다).
4. **구현**: `eslint.config.js` 규칙(src/electron 분리, max-lines 300)을 지키며 구현한다. 건드리는 영역이 위 "스택 관련 참고 스킬" 표에 해당하면 구현 전에 그 스킬을 먼저 불러온다. PostToolUse 훅(`validate-backlog.js`, `check-no-notifications.js`, `lint-changed-file.js`)이 매 Write/Edit마다 자동 실행된다.
5. **병렬 검토 착수**: `cli.js list` 결과의 `_source.sha256`(입력 버전)를 고정해 `critical-reviewer`와 `backlog-explainer`(`.claude/agents/`) 서브에이전트 프롬프트에 동일 스냅샷으로 넣고 병렬 실행한다. `set-status <id> in_review`로 전환하고, 두 에이전트가 끝날 때까지 메인 세션은 backlog.json을 갱신하지 않는다.
6. **반영과 재검증**: critical-reviewer가 파일/코드 근거를 댄 지적만 반영한다(근거 없는 추측은 7번처럼 needs_info로 남긴다). 반영 후 `set-status`/`add`/`set-field`로 갱신하면 `validate-backlog.js`가 자동 재검증한다.
7. **완료 기록**: done_when 충족 + 관련 훅 전부 통과(TIMEOUT/미검증도 미통과로 간주) + critical-reviewer 지적 반영 확인, 이 세 가지가 모두 될 때만 `cli.js set-status <id> done --note=<근거>`. 하나라도 빠지면 `needs_info` 또는 `blocked`로 남긴다.
8. **문서·대시보드 확인**: backlog.json이 바뀌면 `docs/backlog/<id>.md`가 최신인지 확인하고(필요하면 backlog-explainer 재실행), `tools/backlog-dashboard.html`에서 파일을 다시 선택해 최신 상태를 눈으로 확인한다.
9. **상태는 항상 backlog.json에 기록**: 상태가 바뀔 때마다 `set-status`로 즉시 반영한다 — 세션이 끊겨도 다음 세션이 backlog.json만 보고 바로 이어갈 수 있어야 한다(전역 CLAUDE.md의 세션 시작 확인 규칙의 전제조건).
