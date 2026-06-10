@echo off
echo ============================================================
echo   AegisKYC — Environment Setup
echo ============================================================

echo.
echo [1/3] Creating Python virtual environment...
cd /d "%~dp0backend"
python -m venv venv
if errorlevel 1 (
    echo ERROR: Failed to create virtual environment. Is Python 3.10+ installed?
    pause
    exit /b 1
)
echo       OK - venv created

echo.
echo [2/3] Installing Python dependencies...
call venv\Scripts\activate.bat
pip install --upgrade pip --quiet
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: pip install failed. Check requirements.txt and your internet connection.
    pause
    exit /b 1
)
echo       OK - Backend dependencies installed

echo.
echo [3/3] Installing frontend Node.js dependencies...
cd /d "%~dp0frontend"
npm install
if errorlevel 1 (
    echo ERROR: npm install failed. Is Node.js installed?
    pause
    exit /b 1
)
echo       OK - Frontend dependencies installed

echo.
echo ============================================================
echo   Setup complete!
echo   Run start.bat to launch AegisKYC
echo ============================================================
pause
