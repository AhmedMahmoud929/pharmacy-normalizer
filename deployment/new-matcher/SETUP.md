# new-matcher.bya3online.com — Server Setup (Deploy Key)

Standalone deployment on a **new server**. The old `pharmatcher.bya3online.com` instance is not touched.

| Role | Domain | Internal port |
|------|--------|---------------|
| Frontend | `new-matcher.bya3online.com` | 3000 |
| Backend | `new-matcher-api.bya3online.com` | 8000 |

App directory: `/var/www/new-matcher.bya3online.com`

Repository: `git@github.com:ics-group2026/pharmatcher.git`

---

## 1. DNS

Create **A records** pointing to the new server IP:

- `new-matcher.bya3online.com`
- `new-matcher-api.bya3online.com`

---

## 2. System packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3-pip python3-venv python3-dev nginx git curl build-essential

curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

sudo npm install -g pnpm pm2
```

Open ports **80** and **443**.

---

## 3. GitHub Deploy Key (read-only)

On the **new server**:

```bash
ssh-keygen -t ed25519 -C "new-matcher-deploy" -f ~/.ssh/pharmatcher_deploy -N ""
cat ~/.ssh/pharmatcher_deploy.pub
```

In GitHub: **ics-group2026/pharmatcher** → Settings → Deploy keys → Add deploy key

- Title: `new-matcher-server`
- Key: paste the `.pub` content
- Allow write access: **off** (read-only is enough)

Configure SSH to use this key for GitHub:

```bash
cat >> ~/.ssh/config <<'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/pharmatcher_deploy
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config ~/.ssh/pharmatcher_deploy
ssh -T git@github.com
```

Expected: `Hi ics-group2026/pharmatcher! You've successfully authenticated...`

---

## 4. Clone the repo

```bash
sudo mkdir -p /var/www/new-matcher.bya3online.com
sudo chown -R $USER:$USER /var/www/new-matcher.bya3online.com

git clone git@github.com:ics-group2026/pharmatcher.git /var/www/new-matcher.bya3online.com
cd /var/www/new-matcher.bya3online.com
```

---

## 5. Configure secrets

```bash
cp deployment/new-matcher/deploy.env.example deploy.env
nano deploy.env
```

Set at minimum:

```bash
JWT_SECRET=<long-random-string>
```

Generate one:

```bash
openssl rand -hex 32
```

---

## 6. Bootstrap (first deploy)

```bash
chmod +x deployment/new-matcher/bootstrap.sh redeploy.sh
./deployment/new-matcher/bootstrap.sh
```

This installs Python deps, imports mappings, enables systemd + PM2 + nginx.

Verify locally:

```bash
curl http://127.0.0.1:8000/health
curl -I http://127.0.0.1:3000
```

---

## 7. SSL

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d new-matcher.bya3online.com -d new-matcher-api.bya3online.com
```

---

## 8. Catalog data (required for matching)

Git does **not** include product JSON, media, or `pharmatcher.db`. After bootstrap you must either:

**A — Crawl from scratch** (slow): follow `deployment/REMOTE-SERVER-SETUP.md` Step 4 Option B.

**B — Copy data** from another machine (if you have a backup):

```bash
rsync -avz user@source:/path/to/backend/data/extracted/ backend/data/extracted/
rsync -avz user@source:/path/to/backend/data/normalized/ backend/data/normalized/
rsync -avz user@source:/path/to/backend/data/media/ backend/data/media/
sudo chown -R www-data:www-data backend/data
sudo systemctl restart fastapi-new-matcher
```

---

## 9. Updates (deploy key + redeploy)

```bash
cd /var/www/new-matcher.bya3online.com
git pull
./redeploy.sh
```

`redeploy.sh` reads `deploy.env` automatically when present.

---

## Service names

| Component | Name |
|-----------|------|
| systemd | `fastapi-new-matcher` |
| PM2 | `new-matcher-frontend` |
| nginx site | `/etc/nginx/sites-available/new-matcher.conf` |

Logs:

```bash
sudo journalctl -u fastapi-new-matcher -f
pm2 logs new-matcher-frontend
```
