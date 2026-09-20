@echo off
title CrimeNet - Starting...
color 0A

echo ============================================
echo   Criminal Network Analysis System
echo   SIH26189 - Smart India Hackathon
echo ============================================
echo.

:: Check Docker
echo [1/5] Checking Docker...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo ERROR: Docker is not installed or not in PATH.
    echo Please install Docker Desktop from https://docker.com
    pause
    exit /b 1
)

docker info >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo ERROR: Docker Desktop is not running.
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)
echo       Docker is ready.
echo.

:: Check .env file
echo [2/5] Checking configuration...
if not exist ".env" (
    echo       .env file not found. Creating from .env.example...
    copy .env.example .env >nul
)
echo       Configuration ready.
echo.

:: Build and start services
echo [3/5] Building and starting services...
echo       This may take a few minutes on first run...
echo.
docker compose up -d --build
if %errorlevel% neq 0 (
    color 0C
    echo ERROR: Docker Compose failed to start.
    pause
    exit /b 1
)
echo.

:: Wait for backend health
echo [4/5] Waiting for services to be ready...
set /a count=0
set /a max_wait=60

:wait_backend
if %count% geq %max_wait% (
    echo.
    echo WARNING: Backend did not become ready in time.
    echo Check logs with: docker compose logs backend
    goto wait_frontend
)
curl -s http://localhost:8000/health >nul 2>&1
if %errorlevel% equ 0 (
    echo       Backend is healthy.
    goto wait_frontend
)
set /a count+=1
echo       Waiting for backend... (%count%s/%max_wait%s)
timeout /t 2 /nobreak >nul
goto wait_backend

:wait_frontend
set /a count=0
set /a max_wait=30

:wait_fe
if %count% geq %max_wait% (
    echo.
    echo WARNING: Frontend did not become ready in time.
    goto open_browser
)
curl -s http://localhost:5173 >nul 2>&1
if %errorlevel% equ 0 (
    echo       Frontend is ready.
    goto open_browser
)
set /a count+=1
echo       Waiting for frontend... (%count%s/%max_wait%s)
timeout /t 2 /nobreak >nul
goto wait_fe

:open_browser
echo.

:: Open browser
echo [5/5] Opening browser...
start http://localhost:5173
echo.

echo ============================================
echo   All services are running!
echo ============================================
echo.
echo   Frontend:  http://localhost:5173
echo   Backend:   http://localhost:8000
echo   API Docs:  http://localhost:8000/docs
echo   Neo4j:     http://localhost:7474
echo.
echo   To stop:   STOP_PROJECT.bat
echo   To view logs: docker compose logs -f
echo ============================================
echo.
pause
