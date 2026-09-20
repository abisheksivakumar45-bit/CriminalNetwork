#!/bin/bash

echo "============================================"
echo "  Criminal Network Analysis System"
echo "  Stopping all services..."
echo "============================================"
echo

docker compose down

echo
echo "============================================"
echo "  All services stopped."
echo "============================================"
echo
echo "  Data is preserved in Docker volumes."
echo "  To remove all data: docker compose down -v"
echo "  To restart: ./start.sh"
echo "============================================"
