@echo off
rem 더블클릭 한 번으로 backlog 대시보드를 띄운다.
rem 이 프로젝트의 backlog.json/docs를 고정된 상대경로로 읽는 로컬 서버를 백그라운드로 켜면
rem 서버가 알아서 기본 브라우저를 연다 — 선택/파일 열기 과정이 전혀 필요 없다.
rem 포트가 막혀 있으면 자동으로 다음 포트를 쓰고, 이미 이 프로젝트용 서버가 떠 있으면
rem 새로 띄우지 않고 그 창만 연다(동시에 여러 프로젝트를 열어도 서로 안 겹친다).
rem 10분간 요청이 없으면 서버가 스스로 종료된다 — 브라우저를 닫고 그냥 둬도 된다.
chcp 65001 >nul
cd /d "%~dp0.."
start "" /min cmd /c "node tools\serve-dashboard.js"
