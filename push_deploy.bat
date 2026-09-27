@echo off
chcp 65001 > nul
echo ========================================================
echo   LUNA2000 DEPLOYMENT: Pushing 'stable' to GitHub
echo ========================================================
echo.
cd /d "%~dp0"
echo Pushing branch 'stable' to origin...
git push origin stable
echo.
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Branch 'stable' successfully pushed!
    echo GitHub Actions deployment pipeline is now triggered.
    echo You can track the deployment here:
    echo   https://github.com/Capybara77/luna2000-test-deploy/actions
) else (
    echo [ERROR] Git push failed.
)
echo.
pause
