# 🚀 Pharmatch AI — Production Linux Deployment Guide

This guide describes how to deploy the **Pharmatch AI** frontend (Next.js) and backend (FastAPI + Background crawler) on a Linux server (Ubuntu 20.04/22.04 LTS recommended) under a custom domain/subdomains with SSL.

---

## 🏗️ Architecture Overview

To achieve a production-grade, highly available, secure deployment, we use the following topology:

*   **Frontend (Next.js)**: Runs locally on port `3000` via **Node.js + PM2** process manager.
    *   **Domain**: `app.yourdomain.com`
*   **Backend (FastAPI)**: Runs locally on port `8000` via **Uvicorn + Systemd** background service. It runs in a Python virtual environment containing both the FastAPI requirements and the `shefaa-crawler` dependencies.
    *   **Domain**: `api.yourdomain.com`
*   **Reverse Proxy & SSL**: **Nginx** acts as the ingress controller, proxying external requests to the correct internal ports, handling Let's Encrypt **SSL termination**, and disabling proxy buffering for Server-Sent Events (SSE) streaming.

```
                   ┌──────────────┐
                   │  User Agent  │
                   └──────┬───────┘
                          │ (HTTPS)
                          ▼
                  ┌───────────────┐
                  │ Nginx Proxy   │
                  └┬─────────────┬┘
                   │             │
(proxy_pass: 3000) │             │ (proxy_pass: 8000, buffering off)
                   ▼             ▼
             ┌───────────┐ ┌───────────┐
             │ Next.js   │ │ FastAPI   │ ──(spawns background)──► [shefaa-crawler wizard]
             │ (PM2 bg)  │ │ (Systemd) │
             └───────────┘ └───────────┘
```

---

## 📋 Prerequisites

Before starting, ensure you have:
1.  A clean **Linux Server** (Ubuntu 20.04/22.04).
2.  A public static IPv4 address.
3.  Two **DNS A Records** pointing to your server's IP address:
    *   `app.yourdomain.com` (Frontend)
    *   `api.yourdomain.com` (Backend)
4.  Open ports `80` (HTTP) and `443` (HTTPS) on your server/firewall.

---

## 🛠️ Step-by-Step Installation

### Step 1: Install System Dependencies
Connect to your Linux server via SSH and update system packages, then install Node.js 20, Python 3, Git, Nginx, and Certbot:

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Python, build tools, Nginx and Git
sudo apt install -y python3-pip python3-venv python3-dev nginx git curl build-essential

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm globally
sudo npm install -g pnpm

# Install PM2 globally (for Next.js process management)
sudo npm install -g pm2
```

---

### Step 2: Deploy Project Directory
We will deploy the codebase to `/var/www/drug-mapping`. Clone your repository there or copy the files over:

```bash
# Create target directory
sudo mkdir -p /var/www/drug-mapping

# Change owner to current user to allow copying files
sudo chown -R $USER:$USER /var/www/drug-mapping

# [Action]: Clone or copy your code files into /var/www/drug-mapping
# Example: git clone https://github.com/AhmedMahmoud929/pharmacy-normalizer.git /var/www/drug-mapping
```

---

### Step 3: Configure and Run Backend (FastAPI)

Since the FastAPI server spawns the crawler subprocesses dynamically in the background using `sys.executable`, running FastAPI within a single virtual environment (`venv`) ensures the crawler automatically inherits the correct Python path and dependencies!

#### 1. Setup Virtual Environment & Install Packages
```bash
cd /var/www/drug-mapping/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install main backend dependencies (pandas, openpyxl, fastapi, uvicorn, etc.)
# If you don't have a requirements.txt, run:
pip install fastapi uvicorn pandas openpyxl pydantic[email] meilisearch requests rich

# Go to shefaa-crawler and install its dependencies in the same environment
cd /var/www/drug-mapping/shefaa-crawler
# If there is a requirements.txt here:
pip install -r README.md # Or manual install:
pip install rich requests meilisearch beautifulsoup4 lxml

# Deactivate venv
deactivate
```

#### 2. Create the Database Files
Make sure the baseline database JSON file exists so the API can start correctly.
```bash
# Verify raw database or normalized database is in /var/www/drug-mapping/backend/data/
# If needed, create directories:
mkdir -p /var/www/drug-mapping/backend/data
```

#### 3. Enable Systemd Background Service
We will run FastAPI as a background service that automatically boots with the system and restarts on crash.

Copy the systemd configuration file we created:
```bash
# Copy service template to systemd directory
sudo cp /var/www/drug-mapping/deployment/fastapi.service /etc/systemd/system/fastapi.service

# Reload systemd, enable and start service
sudo systemctl daemon-reload
sudo systemctl enable fastapi
sudo systemctl start fastapi

# Check if it is running successfully
sudo systemctl status fastapi
```

Verify the API is responding locally:
```bash
curl http://127.0.0.1:8000/health
# Expected: {"status":"ok","database_loaded":true}
```

---

### Step 4: Configure and Build Frontend (Next.js)

> [!IMPORTANT]
> Next.js compiles environment variables prefixed with `NEXT_PUBLIC_` directly into the static JavaScript bundle at **compile-time** (during `pnpm run build`). Setting `NEXT_PUBLIC_API_URL` at runtime will have no effect. You **must** pass it to the build command!

#### 1. Install Packages
```bash
cd /var/www/drug-mapping/frontend
pnpm install
```

#### 2. Build the Application
Compile the Next.js assets, passing your subdomain API url explicitly:
```bash
# Replace with your actual backend API subdomain
NEXT_PUBLIC_API_URL=https://api.yourdomain.com pnpm run build
```

#### 3. Launch with PM2 Background Manager
Use PM2 to run the Next.js production server on port `3000` in the background and ensure it persists across system reboots:
```bash
# Start frontend server under PM2
pm2 start "pnpm run start" --name "pharmatch-frontend"

# Configure PM2 to start on system boot
pm2 startup

# (Copy-paste the output command from the screen to enable startup persistence)

# Save current PM2 processes list
pm2 save
```

Verify the frontend is running locally:
```bash
curl http://127.0.0.1:3000
```

---

### Step 5: Configure Nginx Reverse Proxy

Nginx acts as the gatekeeper. It listens on port `80` (HTTP) and `443` (HTTPS) and routes traffic to the correct local port based on the subdomain.

```bash
# Copy pre-configured Nginx file to Nginx available configurations
sudo cp /var/www/drug-mapping/deployment/nginx.conf /etc/nginx/sites-available/drug-mapping.conf

# Enable the configuration by creating a symlink in sites-enabled
sudo ln -s /etc/nginx/sites-available/drug-mapping.conf /etc/nginx/sites-enabled/

# Disable default Nginx configuration block to avoid domain conflicts
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration syntax
sudo nginx -t
# Expected: nginx: configuration file /etc/nginx/nginx.conf test is successful

# Restart Nginx
sudo systemctl restart nginx
```

---

### Step 6: Install SSL Certificates via Let's Encrypt

Security is mandatory. We will obtain free, automated wildcard/subdomain SSL certificates using **Certbot**:

```bash
# Install Certbot's Nginx plugin
sudo apt install -y certbot python3-certbot-nginx

# Request and install certificates (Certbot will automatically edit your Nginx files to mount SSL!)
# Follow the interactive prompts, accept the terms, and select "Redirect HTTP to HTTPS"
sudo certbot --nginx -d app.yourdomain.com -d api.yourdomain.com
```

Nginx will reload automatically. Certbot also schedules a systemd cronjob to automatically renew the certificates before they expire.

---

## 📈 Monitoring & Maintenance

### Check Service Logs (FastAPI)
View real-time backend output logs (ideal for debugging crawler and matching operations):
```bash
sudo journalctl -u fastapi -f
```

### Restart Services
```bash
# Restart Backend
sudo systemctl restart fastapi

# Restart Frontend
pm2 restart pharmatch-frontend

# Reload Nginx
sudo systemctl reload nginx
```

### Check PM2 Status
```bash
pm2 list
pm2 logs pharmatch-frontend
```

---

## 🔒 Permission Guidelines
Ensure Nginx (`www-data`) has proper read/write permissions to database files (so manual matches and logs can be written safely):
```bash
sudo chown -R www-data:www-data /var/www/drug-mapping/backend/data
sudo chmod -R 775 /var/www/drug-mapping/backend/data
```
