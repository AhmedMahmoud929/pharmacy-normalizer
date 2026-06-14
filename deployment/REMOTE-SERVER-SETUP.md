# Pharmatch AI — Remote Server Setup Guide

This guide walks through deploying Pharmatch AI on a fresh Linux server (Ubuntu 20.04/22.04 LTS recommended): installing dependencies, bootstrapping the product catalog and mappings, and running the backend and frontend in production.

Replace placeholders before you run commands:

| Placeholder | Example |
|---|---|
| `APP_DIR` | `/var/www/drug-mapping` |
| `APP_DOMAIN` | `app.yourdomain.com` |
| `API_DOMAIN` | `api.yourdomain.com` |
| `REPO_URL` | `https://github.com/your-org/drug-mapping.git` |

---

## Architecture

```
User (HTTPS)
    │
    ▼
 Nginx  ──► app.yourdomain.com  →  Next.js (PM2, port 3000)
    │
    └──► api.yourdomain.com   →  FastAPI (systemd, port 8000)
                                      │
                                      └── spawns shefaa-crawler subprocesses
```

---

## What ships in git vs. what you must build

**Included in the repository:**

- Application source code (frontend + backend)
- `backend/normalizer/mappings/db/mappings_export.json` — brand, token, and stop-word mappings
- `backend/data/ghanem_products.json` — supplemental product stubs

**Not in git (gitignored — must be crawled, generated, or copied from another server):**

| Path | Purpose |
|---|---|
| `backend/data/extracted/` | Raw Chefaa products, categories, brands JSON |
| `backend/data/normalized/` | Normalized product catalog (preferred by the API) |
| `backend/data/media/` | Product and brand images |
| `backend/data/input/` | Excel sheets to match |
| `backend/normalizer/mappings/db/mappings.db` | SQLite mapping database (rebuilt from export) |

The API loads `backend/data/normalized/chefaa_products_eg_normalized.json` first and falls back to `backend/data/extracted/chefaa_products_eg.json` if the normalized file is missing.

---

## Step 1 — Install system dependencies

```bash
sudo apt update && sudo apt upgrade -y

sudo apt install -y python3-pip python3-venv python3-dev nginx git curl build-essential

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Package managers and process manager
sudo npm install -g pnpm pm2
```

Open ports **80** and **443** on your firewall. Create DNS **A records** for `APP_DOMAIN` and `API_DOMAIN` pointing to the server IP.

---

## Step 2 — Deploy the codebase

```bash
sudo mkdir -p APP_DIR
sudo chown -R $USER:$USER APP_DIR

git clone REPO_URL APP_DIR
cd APP_DIR
```

---

## Step 3 — Backend virtual environment

All backend and crawler scripts share one Python environment so subprocess crawls inherit the same dependencies.

```bash
cd APP_DIR/backend

python3 -m venv venv
source venv/bin/activate

pip install --upgrade pip
pip install fastapi uvicorn pandas openpyxl pydantic meilisearch requests rich \
            beautifulsoup4 lxml tqdm opencv-python numpy Pillow python-multipart
```

If `backend/tools/requirements.txt` exists, also run:

```bash
pip install -r tools/requirements.txt
```

---

## Step 4 — Bootstrap data

Choose **one** of the two options below.

### Option A — Copy from an existing server (fastest)

If you already have a working deployment, rsync the data directories:

```bash
# Run from your local machine or the source server
rsync -avz --progress \
  user@old-server:APP_DIR/backend/data/extracted/ \
  APP_DIR/backend/data/extracted/

rsync -avz --progress \
  user@old-server:APP_DIR/backend/data/normalized/ \
  APP_DIR/backend/data/normalized/

rsync -avz --progress \
  user@old-server:APP_DIR/backend/data/media/ \
  APP_DIR/backend/data/media/
```

Then continue at **Step 4.2** to rebuild the mapping database.

### Option B — Crawl and generate from scratch

This downloads the full Egyptian Chefaa catalog (~29k products), categories, brands, and media. Requires an active internet connection and can take a long time.

#### 4.1 — Create data directories

```bash
cd APP_DIR/backend
source venv/bin/activate

mkdir -p data/extracted data/normalized data/media/products data/media/brands data/input
```

#### 4.2 — Import version-controlled mappings into SQLite

```bash
python tools/import_mappings.py
```

Rebuilds `normalizer/mappings/db/mappings.db` from `mappings_export.json`.

#### 4.3 — Crawl products, categories, and brands

```bash
cd tools/shefaa-crawler

# Products (~29k Egyptian catalog)
python main.py --products medications --pages all --deep --localize \
  --output ../../data/extracted/chefaa_products_eg.json

# Categories (with cover images)
python main.py --categories --sub-categories --localize --download \
  --output ../../data/extracted/categories_localized.json

# Brands (with logos → data/media/brands/)
python main.py --brands --localize --download \
  --output ../../data/extracted/chefaa_brands_eg.json
```

Product images are saved under `backend/data/media/products/` when `--download` is used. For large catalogs you can also run catalog and media as separate phases via `--crawl-mode catalog` then `--crawl-mode media`.

#### 4.4 — Seed additional brand mappings

```bash
cd APP_DIR/backend

python tools/seed_chefaa_brands.py
python tools/seed_extracted_mappings.py   # optional: extrapolate more tokens from products
```

#### 4.5 — Normalize the product catalog

```bash
python tools/normalize.py --file data/extracted/chefaa_products_eg.json
```

Output: `backend/data/normalized/chefaa_products_eg_normalized.json`

#### 4.6 — Optional extras

```bash
# Merge supplemental Ghanem product stubs (already in git)
python tools/merge_ghanem_products.py

# Normalize input Excel sheets (place files in backend/data/input/ first)
python tools/normalize.py --file data/input/standard.xlsx
```

---

## Step 5 — Backend service (systemd)

Edit `deployment/fastapi.service` and set `WorkingDirectory`, `Environment`, and `ExecStart` to match your `APP_DIR`, then install the unit:

```bash
# Update paths inside the service file first, then:
sudo cp APP_DIR/deployment/fastapi.service /etc/systemd/system/fastapi.service

sudo systemctl daemon-reload
sudo systemctl enable fastapi
sudo systemctl start fastapi
sudo systemctl status fastapi
```

Verify locally:

```bash
curl http://127.0.0.1:8000/health
# Expected: {"status":"ok","database_loaded":true}
```

If `database_loaded` is `false`, the product JSON files from Step 4 are missing or failed to parse. Check logs:

```bash
sudo journalctl -u fastapi -n 50
```

---

## Step 6 — Frontend build and PM2

> `NEXT_PUBLIC_API_URL` is baked in at **build time**. Set it to your public API URL before running `pnpm run build`.

```bash
cd APP_DIR/frontend

pnpm install

NEXT_PUBLIC_API_URL=https://API_DOMAIN pnpm run build

pm2 start "pnpm run start" --name pharmatch-frontend
pm2 startup    # run the command it prints
pm2 save
```

Verify locally:

```bash
curl -I http://127.0.0.1:3000
```

---

## Step 7 — Nginx reverse proxy

Edit `deployment/nginx.conf`: replace domain names and proxy ports to match your setup, then enable the site:

```bash
sudo cp APP_DIR/deployment/nginx.conf /etc/nginx/sites-available/drug-mapping.conf
sudo ln -s /etc/nginx/sites-available/drug-mapping.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t
sudo systemctl restart nginx
```

---

## Step 8 — SSL (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx

sudo certbot --nginx -d APP_DOMAIN -d API_DOMAIN
```

Certbot configures HTTPS and HTTP→HTTPS redirects automatically.

---

## Step 9 — File permissions

The API writes matcher jobs, crawler output, and manual-match data under `backend/data/`:

```bash
sudo chown -R www-data:www-data APP_DIR/backend/data
sudo chmod -R 775 APP_DIR/backend/data
```

---

## Step 10 — Verification checklist

| Check | Command / action |
|---|---|
| API health | `curl https://API_DOMAIN/health` → `database_loaded: true` |
| Products browse | Open frontend → Database Browser shows products |
| Global search | Search for a known drug (e.g. "Panadol") |
| Brand images | Brands page shows logos from `/media/brands/` |
| Matcher upload | Upload a sheet from `backend/data/input/` |
| SSE streaming | Start a matcher job — progress streams without buffering |

---

## Maintenance

```bash
# Backend logs
sudo journalctl -u fastapi -f

# Restart services
sudo systemctl restart fastapi
pm2 restart pharmatch-frontend
sudo systemctl reload nginx

# After updating mappings_export.json from git
cd APP_DIR/backend && source venv/bin/activate
python tools/import_mappings.py
sudo systemctl restart fastapi

# After re-normalizing the catalog
python tools/normalize.py --file data/extracted/chefaa_products_eg.json
sudo systemctl restart fastapi
```

---

## Quick reference — data bootstrap only

If the app is already deployed and you only need to refresh data:

```bash
cd APP_DIR/backend && source venv/bin/activate

python tools/import_mappings.py
python tools/seed_chefaa_brands.py
python tools/normalize.py --file data/extracted/chefaa_products_eg.json
python tools/merge_ghanem_products.py          # optional

sudo systemctl restart fastapi
```
