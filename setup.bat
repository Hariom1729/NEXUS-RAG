@echo off
setlocal enabledelayedexpansion

echo ====================================================
echo      NEXUS-RAG - Full Stack Setup ^& Installation
echo                 (Windows Edition)
echo ====================================================

cd /d "%~dp0"

echo.
echo [1/4] Checking system prerequisites...

:: Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in your Windows PATH.
    echo Please install Python 3.10+ from https://www.python.org/downloads/
    echo (Make sure to check "Add python.exe to PATH" during installation)
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version') do echo [OK] Found Python: %%i

:: Check Node.js
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in your Windows PATH.
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do echo [OK] Found Node.js: %%i

:: Check npm
npm -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed or not in your Windows PATH.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('npm -v') do echo [OK] Found npm: v%%i

:: Check Tesseract
where tesseract >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Found Tesseract OCR
) else (
    echo [INFO] Tesseract OCR not detected in PATH.
    echo        For scanned PDF / image OCR support on Windows:
    echo        Download from: https://github.com/UB-Mannheim/tesseract/wiki
)

echo.
echo [2/4] Setting up Backend Python environment ^& packages...
cd /d "%~dp0backend"

if not exist ".venv" (
    echo Creating virtual environment in backend\.venv...
    python -m venv .venv
)

echo Activating virtual environment...
call .venv\Scripts\activate.bat

echo Upgrading pip...
python -m pip install --upgrade pip

echo Installing backend Python packages from requirements.txt...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [WARNING] Some packages reported warnings. Continuing setup...
)

if not exist ".env" (
    echo Creating backend\.env from .env.example...
    copy .env.example .env >nul
)
echo [OK] Backend dependencies installed!

echo.
echo [3/4] Setting up Frontend React packages...
cd /d "%~dp0frontend"

if not exist ".env" (
    echo Creating frontend\.env from .env.example...
    copy .env.example .env >nul
)

echo Installing frontend npm packages (this may take 1-2 minutes)...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Frontend npm install failed.
    pause
    exit /b 1
)
echo [OK] Frontend dependencies installed!

cd /d "%~dp0"
echo.
echo ====================================================
echo      All Backend and Frontend packages installed!
echo ====================================================
echo.
echo Next steps:
echo   1. Start MongoDB (running as a Windows Service or via Docker)
echo   2. Start LM Studio or Ollama (port 1234 or 11434)
echo   3. Launch the full application with:
echo         start.bat
echo.
pause
