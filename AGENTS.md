# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project status

Scaffolding is in place and under active development via the backlog (see `backlog.json` / `scripts/backlog/cli.js`). Actual commands:
- `npm run dev` — Vite dev server + Electron together
- `npm run build` — renderer production build (`vite build`)
- `npm run dist` — build + `electron-builder` packaging
- `npm run lint` — `eslint .`
- `npm test` — `vitest run`, covers `src/lib/*.js` pure functions (added in P6.5; DOM/screen tests are out of scope until a jsdom-like environment is added)

## What this project is

A Windows tray-resident desktop widget (single user, no sync) for managing projects, todos, memos, and a calendar/routine schedule in one place. Full spec lives in `work-widget-requirements.md`: Part A is direction/scope, Part B is the detailed spec (B1–B2 UI flows, B3 data schema, B4 behavior, B5 widget lifecycle).

## Architecture decisions already locked in the requirements

- **Stack**: Electron (React/JS), packaged with `electron-builder`; auto-registered as a Windows startup item.
- **Storage**: local-only, no cloud/server sync. A single `data.json` holds four arrays — `projects`, `todos`, `memos`, `schedules` (see requirements B3 for field-level schema). Splitting into per-entity files is an accepted future migration if the single file grows too large.
- **Derived vs. stored fields**: `Project.progress` is never persisted — it's computed at read time from the completion ratio of that project's todos.
- **Recurring schedules**: a recurring schedule is one rule record (with `recurrence_days`), not one record per occurrence. Editing a recurring schedule updates the rule and applies to all future occurrences; per-occurrence exceptions are out of scope.
- **Project status auto-transitions**: all todos complete → project auto-flips to "완료"; unchecking a todo or adding a new one to a completed project flips it back to "진행중" automatically. "보류" is only ever set manually, never automatic.
- **No desktop notifications**: due/upcoming items surface only in the in-widget dashboard, not OS notifications.
- **Window close (X) ≠ quit**: closing hides to tray; there is no in-app quit — the process only ends on Windows shutdown/logout.
- **Backup**: periodic local backup of `data.json` is required; exact frequency/retention count is left to implementation (requirements call out daily/keep-recent as the default assumption, not final).

Anything not covered above (exact UI pixel behavior, backup cadence, etc.) should be resolved by reading the relevant B-section in `work-widget-requirements.md` rather than guessed.
