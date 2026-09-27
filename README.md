# TaskDock

Windows 트레이 상주형 개인용 업무 위젯. 프로젝트, 할일, 메모, 일정(캘린더/반복 루틴)을 로컬 `data.json` 하나에 모아 관리하고, 등록된 외부 프로젝트의 backlog(.json)를 읽기 전용으로 현황판처럼 보여주며, 그 변경 내역을 codex CLI로 요약해 주간보고 문단을 자동 생성해준다.

## 스택

- Electron(메인 프로세스) + React(렌더러), Vite 빌드
- 저장: 로컬 `data.json` 단일 파일(클라우드/서버 동기화 없음), 원자적 쓰기 + 일일 백업
- 패키징: `electron-builder`(NSIS 설치형 + 포터블 두 가지)
- 테스트: Vitest(`src/lib/**`, `electron/**`, `scripts/backlog/**`의 순수 함수/로직)

## 시작하기

```bash
npm install
npm run dev     # Vite 개발 서버 + Electron 동시 실행
```

## 주요 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 모드(Vite + Electron, 핫 리로드) |
| `npm run build` | 렌더러 프로덕션 빌드(`dist/`) |
| `npm run dist` | 빌드 + `electron-builder` 패키징(`release/`) — 실행 중인 인스턴스가 있으면 파일 잠금으로 실패할 수 있음, 먼저 종료 필요 |
| `npm run lint` | `eslint .` |
| `npm test` | `vitest run` |
| `npm run backlog:dashboard` | `backlog.json` 진행 상황을 보는 로컬 대시보드(`tools/backlog-dashboard.html`) 서빙 |

## 문서

- 전체 기능 스펙: [`work-widget-requirements.md`](./work-widget-requirements.md) — Part A(방향성) + Part B(화면/데이터/동작 상세), 각 결정 사항과 critical-reviewer 리뷰 반영 내역까지 포함된 이 프로젝트의 단일 진실 공급원(source of truth)
- 개발 진행 상황: `backlog.json`(직접 열지 말고 `node scripts/backlog/cli.js list|show|ready` 등 조회 CLI 사용) + 사람이 읽기 쉬운 요약은 `docs/backlog/<id>.md`
- Claude Code로 이 저장소에서 작업할 때의 워크플로: [`CLAUDE.md`](./CLAUDE.md), [`.claude/rules/backlog-workflow.md`](./.claude/rules/backlog-workflow.md)

## 데이터 위치

앱 실행 시 `data.json`은 Electron의 `userData` 경로(Windows 기준 `%APPDATA%\taskdock`)에 저장된다. 클라우드 동기화는 없고, 이 컴퓨터에서만 로컬로 관리된다.
