#!/usr/bin/env bash
# ==============================================================================
# NEXUS-RAG — 1-Click Startup Script for macOS & Linux
# Starts both FastAPI Backend (port 8001) and React Frontend (port 3000)
# ==============================================================================

# Color helpers
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo -e "${CYAN}====================================================${NC}"
echo -e "${CYAN}            Starting NEXUS-RAG Platform             ${NC}"
echo -e "${CYAN}====================================================${NC}"

# Check virtual environment
if [ ! -d "backend/.venv" ]; then
    echo -e "${YELLOW}Virtual environment not found. Running setup.sh first...${NC}"
    ./setup.sh
fi

# Cleanup function on Ctrl+C
cleanup() {
    echo -e "\n${YELLOW}Shutting down NEXUS-RAG services...${NC}"
    if [ ! -z "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    echo -e "${GREEN}Services stopped cleanly.${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# 1. Start Backend Server
echo -e "\n${YELLOW}[1/2] Starting FastAPI Backend on http://localhost:8001...${NC}"
cd "$PROJECT_ROOT/backend"
source .venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001 &
BACKEND_PID=$!
echo -e "${GREEN}✓ Backend running (PID: $BACKEND_PID)${NC}"

# 2. Start Frontend Server
echo -e "\n${YELLOW}[2/2] Starting React Frontend on http://localhost:3000...${NC}"
cd "$PROJECT_ROOT/frontend"
npm start &
FRONTEND_PID=$!
echo -e "${GREEN}✓ Frontend running (PID: $FRONTEND_PID)${NC}"

echo -e "\n${CYAN}====================================================${NC}"
echo -e "${GREEN}🚀 NEXUS-RAG is running!${NC}"
echo -e "   Frontend: ${CYAN}http://localhost:3000${NC}"
echo -e "   Backend:  ${CYAN}http://localhost:8001${NC}"
echo -e "   Swagger:  ${CYAN}http://localhost:8001/docs${NC}"
echo -e "${YELLOW}Press [CTRL + C] anytime to stop all services.${NC}"
echo -e "${CYAN}====================================================${NC}\n"

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
