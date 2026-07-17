@echo off
REM ══════════════════════════════════════════════════════════════
REM  Monto Parent — APK Build Script for Windows
REM  Builds a debug APK ready to install on Android devices.
REM
REM  Requirements (must be installed first):
REM    1. JDK 21 — Capacitor's Android Gradle module requires it.
REM       Android Studio ships one at:
REM         %ProgramFiles%\Android\Android Studio\jbr
REM       (used automatically below if JAVA_HOME isn't already set)
REM    2. Android Studio (for the SDK) → https://developer.android.com/studio
REM
REM  Usage:
REM    build-apk.bat
REM
REM  Output:
REM    android\app\build\outputs\apk\debug\app-debug.apk
REM ══════════════════════════════════════════════════════════════

echo.
echo  ============================================
echo   Monto Parent APK Builder
echo  ============================================
echo.

if "%JAVA_HOME%"=="" (
    set "JAVA_HOME=%ProgramFiles%\Android\Android Studio\jbr"
    echo Using bundled Android Studio JBR as JAVA_HOME: %JAVA_HOME%
)

REM Step 1: Build the static export (Capacitor needs static assets, not an SSR server)
echo [1/3] Building static export...
call npm run build:apk
if errorlevel 1 (
    echo ERROR: Next.js build failed
    pause
    exit /b 1
)
echo  Done: out/ folder created and synced to android/
echo.

REM Step 2: Build Android debug APK
echo [2/3] Building Android debug APK...
cd android
call gradlew.bat assembleDebug
if errorlevel 1 (
    echo.
    echo ERROR: Android build failed.
    echo.
    echo Make sure you have:
    echo   - JDK 21 installed and JAVA_HOME set
    echo   - Android SDK installed ^(via Android Studio^)
    echo   - ANDROID_HOME or ANDROID_SDK_ROOT environment variable set
    echo.
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo  ============================================
echo   SUCCESS!
echo  ============================================
echo.
echo  APK location:
echo    android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo  Install on connected Android device:
echo    adb install android\app\build\outputs\apk\debug\app-debug.apk
echo.
pause
