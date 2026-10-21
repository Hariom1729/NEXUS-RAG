@echo off
echo ====================================================
echo            Starting NEXUS-RAG Platform
echo                 (Windows Edition)
echo ====================================================

cd /d "%~dp0"

:: Check if virtual environment exists, if not run setup.bat
if not exist "backend\.venv" (
    echo Virtual environment not found. Running setup.bat first...
    call setup.bat
)

echo.
echo [1/2] Starting FastAPI Backend on http://localhost:8001...
start "NEXUS-RAG Backend (FastAPI)" cmd /k "cd /d "%~dp0backend" && call .venv\Scripts\activate.bat && uvicorn server:app --host 0.0.0.0 --port 8001 --reload"

echo.
echo [2/2] Starting React Frontend on http://localhost:3000...
start "NEXUS-RAG Frontend (React)" cmd /k "cd /d "%~dp0frontend" && npm start"

echo.
echo ====================================================
echo   NEXUS-RAG Services are launching!
echo   - Backend:  http://localhost:8001
echo   - Swagger:  http://localhost:8001/docs
echo   - Frontend: http://localhost:3000
echo ====================================================
echo.
timeout /t 3 >nul
start http://localhost:3000
