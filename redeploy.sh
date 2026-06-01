#!/usr/bin/env bash

# ==============================================================================
# 🚀 Pharmatch AI — Production Server Redeployment Script
# ==============================================================================
# This script automates Git pulling, backend dependency checks, Next.js building,
# PM2 process restarts, and system permission alignments.
#
# Usage: ./redeploy.sh
# ==============================================================================

# Exit immediately if a command exits with a non-zero status
set -e

# Colored Output utilities
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}=======================================================${NC}"
echo -e "${CYAN}     🚀 PHARMATCH AI PRODUCTION REDEPLOYMENT WIZARD    ${NC}"
echo -e "${CYAN}=======================================================${NC}"

# 1. Verify working directory
PROJECT_ROOT="/var/www/drug-mapping"
if [ -d "$PROJECT_ROOT" ]; then
    echo -e "${GREEN}✔ Validated production root directory at: ${PROJECT_ROOT}${NC}"
    cd "$PROJECT_ROOT"
else
    echo -e "${YELLOW}⚠ Warning: /var/www/drug-mapping not found. Using current directory: $(pwd)${NC}"
    PROJECT_ROOT=$(pwd)
fi

# 2. Pull latest codebase
echo -e "\n${YELLOW}Step 1: Pulling latest changes from Git...${NC}"
git pull
echo -e "${GREEN}✔ Codebase pulled successfully!${NC}"

# 3. Update and Restart Backend (FastAPI + shefaa-crawler)
echo -e "\n${YELLOW}Step 2: Updating Backend virtual environment...${NC}"
if [ -d "backend/venv" ]; then
    source backend/venv/bin/activate
    echo -e "${GREEN}✔ Activated Python virtual environment.${NC}"
    
    echo -e "${CYAN}Installing backend & crawler packages...${NC}"
    pip install --upgrade pip
    pip install fastapi uvicorn pandas openpyxl pydantic meilisearch requests rich beautifulsoup4 lxml
    
    deactivate
    echo -e "${GREEN}✔ Backend packages aligned.${NC}"
else
    echo -e "${RED}❌ Error: Python virtual environment not found in backend/venv!${NC}"
    echo -e "${YELLOW}Please create it first inside 'backend' by running:${NC}"
    echo -e "  python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
    exit 1
fi

echo -e "${CYAN}Restarting FastAPI systemd service...${NC}"
sudo systemctl restart fastapi
echo -e "${GREEN}✔ FastAPI background service restarted!${NC}"

# 4. Build and Restart Frontend (Next.js)
echo -e "\n${YELLOW}Step 3: Building Frontend (Next.js)...${NC}"
cd "$PROJECT_ROOT/frontend"

# Load any custom env variable if exists
if [ -f ".env.production" ]; then
    echo -e "${GREEN}✔ Found .env.production configuration.${NC}"
fi

echo -e "${CYAN}Installing node packages...${NC}"
pnpm install

echo -e "${CYAN}Triggering Next.js production build bundle...${NC}"
# Next.js embeds NEXT_PUBLIC_ variables at build time. We use the existing environment,
# or default to the standard api subdomain.
if [ -z "$NEXT_PUBLIC_API_URL" ]; then
    # Try to extract from custom .env files if present
    if [ -f ".env.production" ]; then
        NEXT_PUBLIC_API_URL=$(grep -E "^NEXT_PUBLIC_API_URL=" ".env.production" | cut -d'=' -f2- | tr -d '"'\'' ')
    elif [ -f ".env" ]; then
        NEXT_PUBLIC_API_URL=$(grep -E "^NEXT_PUBLIC_API_URL=" ".env" | cut -d'=' -f2- | tr -d '"'\'' ')
    fi
    
    # Fallback to the live production api subdomain
    if [ -z "$NEXT_PUBLIC_API_URL" ]; then
        NEXT_PUBLIC_API_URL="https://pharmatcher-api.bya3online.com"
    fi
fi


echo -e "${CYAN}Building with API URL: ${NEXT_PUBLIC_API_URL}${NC}"
NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL pnpm run build
echo -e "${GREEN}✔ Next.js build completed successfully!${NC}"

echo -e "${CYAN}Restarting Next.js server in PM2...${NC}"
pm2 restart pharmatch-frontend || pm2 start "pnpm run start" --name "pharmatch-frontend"
pm2 save
echo -e "${GREEN}✔ PM2 process list restarted and saved!${NC}"

# 5. Fix permissions for SQLite database access
echo -e "\n${YELLOW}Step 4: Aligning database permission policies...${NC}"
cd "$PROJECT_ROOT"
if [ -d "backend/data" ]; then
    sudo chown -R www-data:www-data backend/data
    sudo chmod -R 775 backend/data
    echo -e "${GREEN}✔ Directory backend/data permissions set to www-data.${NC}"
else
    echo -e "${YELLOW}⚠ Warning: backend/data directory does not exist yet.${NC}"
fi

echo -e "\n${GREEN}=======================================================${NC}"
echo -e "${GREEN}     🎉 REDEPLOYMENT EXECUTED PERFECTLY AND LIVE!      ${NC}"
echo -e "${GREEN}=======================================================${NC}"
