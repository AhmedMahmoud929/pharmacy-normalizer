#!/usr/bin/env bash
# First-time server setup after git clone. Re-runs are mostly safe (idempotent).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}=== Pharmatch AI — new-matcher bootstrap ===${NC}"

if [ ! -f "$PROJECT_ROOT/deploy.env" ]; then
  echo -e "${YELLOW}Creating deploy.env from template...${NC}"
  cp deployment/new-matcher/deploy.env.example "$PROJECT_ROOT/deploy.env"
  echo -e "${RED}Edit deploy.env (JWT_SECRET at minimum), then re-run this script.${NC}"
  exit 1
fi

# shellcheck disable=SC1091
source "$PROJECT_ROOT/deploy.env"

if [ "${JWT_SECRET:-}" = "replace-with-long-random-string" ] || [ -z "${JWT_SECRET:-}" ]; then
  echo -e "${RED}Set JWT_SECRET in deploy.env before continuing.${NC}"
  exit 1
fi

echo -e "${YELLOW}Step 1: Python virtual environment${NC}"
if ! python3 -m venv --help >/dev/null 2>&1; then
  echo -e "${RED}python3-venv is missing. Install it, then re-run:${NC}"
  echo -e "  sudo apt install -y python3-venv python3-dev"
  exit 1
fi
cd "$PROJECT_ROOT/backend"
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install -r tools/requirements.txt
pip install meilisearch requests rich tqdm
deactivate

echo -e "${YELLOW}Step 2: Data directories + mapping DB${NC}"
mkdir -p data/extracted data/normalized data/media/products data/media/brands data/input
source venv/bin/activate
python tools/import_mappings.py
deactivate

echo -e "${YELLOW}Step 3: Backend permissions${NC}"
sudo chown -R www-data:www-data "$PROJECT_ROOT/backend/data"
sudo chmod -R 775 "$PROJECT_ROOT/backend/data"

echo -e "${YELLOW}Step 4: systemd service${NC}"
sudo cp "$PROJECT_ROOT/deployment/new-matcher/fastapi.service" "/etc/systemd/system/${SYSTEMD_SERVICE}.service"
sudo systemctl daemon-reload
sudo systemctl enable "$SYSTEMD_SERVICE"
sudo systemctl restart "$SYSTEMD_SERVICE"

echo -e "${YELLOW}Step 5: Frontend build${NC}"
if ! command -v node >/dev/null 2>&1; then
  echo -e "${RED}Node.js is missing. Install it, then re-run:${NC}"
  echo -e "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
  echo -e "  sudo apt install -y nodejs"
  exit 1
fi
if ! command -v pnpm >/dev/null 2>&1; then
  echo -e "${YELLOW}Installing pnpm...${NC}"
  npm install -g pnpm
fi
if ! command -v pm2 >/dev/null 2>&1; then
  echo -e "${YELLOW}Installing pm2...${NC}"
  npm install -g pm2
fi
cd "$PROJECT_ROOT/frontend"
pnpm install
NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL}" pnpm run build

echo -e "${YELLOW}Step 6: PM2${NC}"
FRONTEND_PORT="${FRONTEND_PORT:-3005}"
pm2 delete "$PM2_APP_NAME" 2>/dev/null || true
pm2 start "$PROJECT_ROOT/frontend/node_modules/.bin/next" \
  --name "$PM2_APP_NAME" \
  --cwd "$PROJECT_ROOT/frontend" \
  -- start -p "$FRONTEND_PORT"
pm2 save

echo -e "${YELLOW}Step 7: Nginx${NC}"
if [ ! -f "$PROJECT_ROOT/deployment/new-matcher/nginx.conf" ]; then
  echo -e "${RED}Missing deployment/new-matcher/nginx.conf${NC}"
  exit 1
fi
sudo cp "$PROJECT_ROOT/deployment/new-matcher/nginx.conf" /etc/nginx/sites-available/new-matcher.conf
sudo ln -sf /etc/nginx/sites-available/new-matcher.conf /etc/nginx/sites-enabled/new-matcher.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

echo -e "${GREEN}Bootstrap done.${NC}"
echo -e "${CYAN}Next: sudo certbot --nginx -d ${APP_DOMAIN} -d ${API_DOMAIN}${NC}"
echo -e "${CYAN}Health: curl http://127.0.0.1:8000/health${NC}"
