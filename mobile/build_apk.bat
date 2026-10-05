@echo off
chcp 65001 > nul
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set ANDROID_HOME=C:\Users\user\AppData\Local\Android\Sdk
set PATH=%JAVA_HOME%\bin;%PATH%
cd /d "%~dp0\android"
echo Building optimized release APK...
call gradlew.bat assembleRelease --no-daemon
if %ERRORLEVEL% EQU 0 (
    echo Copying APK...
    copy /y "app\build\outputs\apk\release\app-release.apk" "..\..\backend-asp-net\luna2000\wwwroot\apk\luna2000.apk"
    copy /y "app\build\outputs\apk\release\app-release.apk" "..\..\backend-asp-net\luna2000\files\luna2000.apk"
    copy /y "app\build\outputs\apk\release\app-release.apk" "..\..\luna2000-driver.apk"
    echo [SUCCESS] APK built and deployed locally!
)
