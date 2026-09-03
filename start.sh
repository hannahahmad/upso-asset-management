#!/usr/bin/env bash

# Function to clean up background processes on exit
cleanup() {
    echo ""
    echo "Stopping servers..."
    kill $(jobs -p) 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

echo "=========================================="
echo "Starting UPSO-1 Full Stack Application"
echo "=========================================="

# Start Backend Server
echo "Starting Backend Server (Port 4000)..."
(cd backend && npm run dev) &

# Start Frontend Dev Server
echo "Starting Frontend Server (Vite)..."
(cd frontend && npm run dev) &

# Wait for all background processes
wait
