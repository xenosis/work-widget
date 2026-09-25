@echo off
rem work-widget dev launcher. Do NOT double-click this file directly from
rem Explorer - it lives inside a Korean-named folder, and Windows fails to
rem resolve a .bat file's own path via double-click when it contains
rem non-ASCII characters (closes instantly, "path not found"). Use
rem C:\Users\Lenovo\Desktop\run-widget.bat instead, or run this from an
rem already-open terminal (cd here, then run-widget.bat).
cd /d "%~dp0"
set DEV_QUIT_ON_CLOSE=1
npm run dev
echo.
echo [done - check the log above for errors]
pause
