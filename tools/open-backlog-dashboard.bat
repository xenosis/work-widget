@echo off
rem 더블클릭 한 번으로 backlog 대시보드를 띄운다.
rem 이 프로젝트의 backlog.json/docs를 고정된 상대경로로 읽는 로컬 서버를 백그라운드로 켜고
rem 곧바로 기본 브라우저로 연다 — 선택/파일 열기 과정이 전혀 필요 없다.
chcp 65001 >nul
cd /d "%~dp0.."
start "" /min cmd /c "node tools\serve-dashboard.js"
timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:5175/"
