#!/bin/bash
set -e

echo "============================================"
echo "  Criminal Network Analysis System"
echo "  SIH26189 - Smart India Hackathon"
echo "============================================"
echo

# Check Docker
echo "[1/4] Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed."
    exit 1
fi

if ! docker info &> /dev/null; then
    echo "ERROR: Docker is not running."
    exit 1
fi
echo "      Docker is ready."
echo

# Check .env
echo "[2/4] Checking configuration..."
if [ ! -f ".env" ]; then
    echo "      Creating .env from .env.example..."
    cp .env.example .env
fi
echo "      Configuration ready."
echo

# Build and start
echo "[3/4] Building and starting services..."
docker compose up -d --build
echo

# Wait for services
echo "[4/4] Waiting for services..."
for i in $(seq 1 30); do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo "      Backend is healthy."
        break
    fi
    echo "      Waiting for backend... (${i}s/30s)"
    sleep 2
done

echo
echo "============================================"
echo "  All services are running!"
echo "============================================"
echo
echo "  Frontend:  http://localhost:5173"
echo "  Backend:   http://localhost:8000"
echo "  API Docs:  http://localhost:8000/docs"
echo "  Neo4j:     http://localhost:7474"
echo
echo "  To stop:   ./stop.sh"
echo "============================================"
