@echo off
echo ========================================================
echo   FASTAPI + REACT-VITE PREMIUM BOILERPLATE QUICKSTART
echo ========================================================
echo.

:: Check for python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH. Please install Python 3.8+.
    pause
    exit /b 1
)

:: Check for node
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH. Please install Node.js 18+.
    pause
    exit /b 1
)

echo [INFO] Starting Backend setup and server...
start "FastAPI Backend Server" cmd /k "cd backend && echo [INFO] Creating Python virtual environment... && python -m venv venv && call venv\Scripts\activate && echo [INFO] Installing python requirements... && pip install -r requirements.txt && echo [INFO] Starting FastAPI on http://localhost:8000 ... && python -m app.main"

echo [INFO] Starting Frontend setup and server...
start "Vite React Frontend Server" cmd /k "cd frontend && echo [INFO] Installing node packages... && npm install && echo [INFO] Starting Vite on http://localhost:5173 ... && npm run dev"

echo.
echo ========================================================
echo   Setup triggered! Check the two new terminal windows.
echo   - Backend API:  http://localhost:8000
echo   - Backend Docs: http://localhost:8000/docs
echo   - Frontend App: http://localhost:5173
echo ========================================================
echo.
pause
