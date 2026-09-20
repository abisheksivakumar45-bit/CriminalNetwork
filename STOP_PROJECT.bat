@echo off
title CrimeNet - Stopping...
color 0E

echo ============================================
echo   Criminal Network Analysis System
echo   Stopping all services...
echo ============================================
echo.

:: Check Docker
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo ERROR: Docker is not available.
    pause
    exit /b 1
)

:: Stop services
echo Stopping services...
docker compose down
if %errorlevel% neq 0 (
    color 0C
    echo WARNING: Some services may not have stopped cleanly.
)

echo.
echo ============================================
echo   All services stopped.
echo ============================================
echo.
echo   Data is preserved in Docker volumes.
echo   To remove all data: docker compose down -v
echo   To restart: START_PROJECT.bat
echo ============================================
echo.
pause
