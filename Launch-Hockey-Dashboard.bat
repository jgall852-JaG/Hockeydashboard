@echo off
cd /d "%~dp0"
node scripts\serve-dashboard.mjs
if errorlevel 1 pause
