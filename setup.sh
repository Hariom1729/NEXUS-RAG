#!/usr/bin/env bash
# ==============================================================================
# NEXUS-RAG — Full Stack Setup Script for macOS & Linux
# Installs all required packages for both Backend (Python) and Frontend (Node.js)
# ==============================================================================

set -e

# Color helpers
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}====================================================${NC}"
echo -e "${CYAN}      NEXUS-RAG — Full Stack Setup & Installation    ${NC}"
echo -e "${CYAN}====================================================${NC}"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# 1. System checks
echo -e "\n${YELLOW}[1/4] Checking system prerequisites...${NC}"

# Python check
if command -v python3 &>/dev/null; then
    PY_BIN=python3
elif command -v python &>/dev/null; then
    PY_BIN=python
else
    echo -e "${RED}Error: Python 3 is not installed or not in PATH.${NC}"
    echo "Please install Python 3.10+ from https://www.python.org/downloads/ or via 'brew install python'."
    exit 1
fi
echo -e "${GREEN}✓ Found Python: $($PY_BIN --version)${NC}"

# Node.js check
if command -v node &>/dev/null; then
    echo -e "${GREEN}✓ Found Node.js: $(node --version)${NC}"
else
    echo -e "${RED}Error: Node.js is not installed or not in PATH.${NC}"
    echo "Please install Node.js 18+ from https://nodejs.org/ or via 'brew install node'."
    exit 1
fi

# npm check
if command -v npm &>/dev/null; then
    echo -e "${GREEN}✓ Found npm: v$(npm --version)${NC}"
else
    echo -e "${RED}Error: npm is not installed.${NC}"
    exit 1
fi

# Tesseract check (optional warning)
if command -v tesseract &>/dev/null; then
    echo -e "${GREEN}✓ Found Tesseract OCR (scanned PDF / image OCR active)${NC}"
else
    echo -e "${YELLOW}ℹ Note: Tesseract OCR not detected. For scanned PDF & image OCR support:${NC}"
    echo "   macOS: brew install tesseract"
    echo "   Ubuntu/Debian: sudo apt-get install tesseract-ocr"
fi

# 2. Backend installation
echo -e "\n${YELLOW}[2/4] Setting up Backend Python environment & packages...${NC}"
cd "$PROJECT_ROOT/backend"

# Setup virtual environment
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment in backend/.venv..."
    $PY_BIN -m venv .venv
fi

# Activate venv
source .venv/bin/activate
echo "Upgrading pip..."
pip install --upgrade pip

# Install requirements
echo "Installing backend Python packages from requirements.txt..."
pip install -r requirements.txt

# Create .env if not exists
if [ ! -f ".env" ]; then
    echo "Creating backend/.env from .env.example..."
    cp .env.example .env
fi
echo -e "${GREEN}✓ Backend dependencies installed successfully!${NC}"

# 3. Frontend installation
echo -e "\n${YELLOW}[3/4] Setting up Frontend React packages...${NC}"
cd "$PROJECT_ROOT/frontend"

# Create .env if not exists
if [ ! -f ".env" ]; then
    echo "Creating frontend/.env from .env.example..."
    cp .env.example .env
fi

echo "Installing frontend npm packages (this may take a minute)..."
npm install
echo -e "${GREEN}✓ Frontend dependencies installed successfully!${NC}"

# 4. Completion
cd "$PROJECT_ROOT"
echo -e "\n${CYAN}====================================================${NC}"
echo -e "${GREEN}🎉 All Backend and Frontend packages installed!${NC}"
echo -e "${CYAN}====================================================${NC}"
echo -e "Next steps to run the application:"
echo -e "  1. Ensure MongoDB is running: ${YELLOW}brew services start mongodb-community${NC}"
echo -e "  2. Ensure LM Studio or Ollama is running on port 1234 or 11434"
echo -e "  3. Start both services using:"
echo -e "     ${GREEN}./start.sh${NC}"
echo -e "     Or manually:"
echo -e "     Terminal 1 (Backend):  ${CYAN}cd backend && source .venv/bin/activate && uvicorn server:app --host 0.0.0.0 --port 8001 --reload${NC}"
echo -e "     Terminal 2 (Frontend): ${CYAN}cd frontend && npm start${NC}"
echo -e "====================================================\n"
