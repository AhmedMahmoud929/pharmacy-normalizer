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
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -d "/var/www/new-matcher.bya3online.com" ]; then
    PROJECT_ROOT="/var/www/new-matcher.bya3online.com"
elif [ -d "/var/www/drug-mapping" ]; then
    PROJECT_ROOT="/var/www/drug-mapping"
elif [ -d "$SCRIPT_DIR" ]; then
    PROJECT_ROOT="$SCRIPT_DIR"
else
    PROJECT_ROOT=$(pwd)
fi

cd "$PROJECT_ROOT"
echo -e "${GREEN}✔ Production root: ${PROJECT_ROOT}${NC}"

# Optional server-specific config (see deployment/new-matcher/deploy.env.example)
if [ -f "$PROJECT_ROOT/deploy.env" ]; then
    # shellcheck disable=SC1091
    source "$PROJECT_ROOT/deploy.env"
    echo -e "${GREEN}✔ Loaded deploy.env${NC}"
fi

PM2_APP_NAME="${PM2_APP_NAME:-pharmatch-frontend}"
SYSTEMD_SERVICE="${SYSTEMD_SERVICE:-fastapi}"

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
    pip install fastapi uvicorn pandas openpyxl pydantic meilisearch requests rich beautifulsoup4 lxml tqdm
    
    deactivate
    echo -e "${GREEN}✔ Backend packages aligned.${NC}"
else
    echo -e "${RED}❌ Error: Python virtual environment not found in backend/venv!${NC}"
    echo -e "${YELLOW}Please create it first inside 'backend' by running:${NC}"
    echo -e "  python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
    exit 1
fi

echo -e "${CYAN}Restarting FastAPI systemd service (${SYSTEMD_SERVICE})...${NC}"
sudo systemctl restart "$SYSTEMD_SERVICE"
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
    
    # Fallback API URL
    if [ -z "$NEXT_PUBLIC_API_URL" ]; then
        if [ "$PROJECT_ROOT" = "/var/www/new-matcher.bya3online.com" ]; then
            NEXT_PUBLIC_API_URL="https://new-matcher-api.bya3online.com"
        else
            NEXT_PUBLIC_API_URL="https://pharmatcher-api.bya3online.com"
        fi
    fi
fi


if [ -z "${JWT_SECRET:-}" ]; then
    echo -e "${RED}❌ JWT_SECRET is missing. Set it in deploy.env (must match the backend).${NC}"
    exit 1
fi

echo -e "${CYAN}Building with API URL: ${NEXT_PUBLIC_API_URL}${NC}"
JWT_SECRET="${JWT_SECRET}" NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL}" pnpm run build
echo -e "${GREEN}✔ Next.js build completed successfully!${NC}"

echo -e "${CYAN}Restarting Next.js server in PM2...${NC}"
FRONTEND_PORT="${FRONTEND_PORT:-3005}"
pm2 delete "$PM2_APP_NAME" 2>/dev/null || true
JWT_SECRET="${JWT_SECRET}" pm2 start "$PROJECT_ROOT/frontend/node_modules/.bin/next" \
  --name "$PM2_APP_NAME" \
  --cwd "$PROJECT_ROOT/frontend" \
  --update-env \
  -- start -p "$FRONTEND_PORT"
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
