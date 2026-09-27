@echo off
chcp 65001 > nul
echo Creating LUNA2000 database backup...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\backup_db.ps1"
pause
