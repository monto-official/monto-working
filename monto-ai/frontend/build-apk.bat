@echo off
REM ══════════════════════════════════════════════════════════════
REM  Monto AI — APK Build Script for Windows
REM  Builds a debug APK ready to install on Android devices.
REM
REM  Requirements (must be installed first):
REM    1. JDK 17  → https://adoptium.net/
REM    2. Android Studio (for SDK) → https://developer.android.com/studio
REM       OR just Android command-line tools
REM
REM  Usage:
REM    build-apk.bat
REM
REM  Output:
REM    android\app\build\outputs\apk\debug\app-debug.apk
REM ══════════════════════════════════════════════════════════════

echo.
echo  ============================================
echo   Monto AI APK Builder
echo  ============================================
echo.

REM Step 1: Build Next.js static export
echo [1/3] Building Next.js static export...
call npm run build
if errorlevel 1 (
    echo ERROR: Next.js build failed
    pause
    exit /b 1
)
echo  Done: out/ folder created
echo.

REM Step 2: Sync web assets to Android
echo [2/3] Syncing to Android...
call npx cap sync android
if errorlevel 1 (
    echo ERROR: Capacitor sync failed
    pause
    exit /b 1
)
echo  Done: assets synced
echo.

REM Step 3: Build Android debug APK
echo [3/3] Building Android debug APK...
cd android
call gradlew.bat assembleDebug
if errorlevel 1 (
    echo.
    echo ERROR: Android build failed.
    echo.
    echo Make sure you have:
    echo   - JDK 17 installed and JAVA_HOME set
    echo   - Android SDK installed (via Android Studio)
    echo   - ANDROID_HOME or ANDROID_SDK_ROOT environment variable set
    echo.
    echo Download JDK 17: https://adoptium.net/
    echo Download Android Studio: https://developer.android.com/studio
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
