@echo off
echo ============================================================
echo   AegisKYC — Starting Services
echo ============================================================
echo.
echo   Backend  : http://localhost:8001
echo   Frontend : http://localhost:5173
echo   API Docs : http://localhost:8001/docs
echo.
echo   Press Ctrl+C in each window to stop
echo ============================================================
echo.

:: Start FastAPI backend in a new window
start "AegisKYC Backend (FastAPI)" cmd /k "cd /d "%~dp0backend" && call venv\Scripts\activate.bat && uvicorn app:app --host 0.0.0.0 --port 8001 --reload"

:: Small delay to let backend start first
timeout /t 2 /nobreak > nul

:: Start Vite frontend in a new window
start "AegisKYC Frontend (Vite)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo   Both services launched in separate windows.
echo   Opening browser...
timeout /t 3 /nobreak > nul
start http://localhost:5173
