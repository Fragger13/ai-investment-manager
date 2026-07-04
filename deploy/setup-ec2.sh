#!/usr/bin/env bash
# AskPapa backend bootstrap for a fresh Ubuntu 24.04 EC2 instance (t3.micro).
#
# Usage (on the instance, after cloning the repo):
#   git clone <repo-url> ~/askpapa
#   cd ~/askpapa && bash deploy/setup-ec2.sh api.yourdomain.com yourdomain.com
#
# Idempotent: safe to re-run after changing the domain or pulling new code.
set -euo pipefail

API_DOMAIN="${1:?usage: setup-ec2.sh <api-domain> <app-domain>  e.g. setup-ec2.sh api.askpapa.in askpapa.in}"
APP_DOMAIN="${2:?usage: setup-ec2.sh <api-domain> <app-domain>  e.g. setup-ec2.sh api.askpapa.in askpapa.in}"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUN_USER="$(whoami)"

echo "==> App dir: $APP_DIR | API: https://$API_DOMAIN | App: https://$APP_DOMAIN"

# --- 2GB swap: the t3.micro has 1GB RAM ------------------------------------
if [ ! -f /swapfile ]; then
  echo "==> Creating 2GB swapfile"
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

# --- Packages ----------------------------------------------------------------
echo "==> Installing packages"
sudo apt-get update -y
sudo apt-get install -y python3-venv python3-pip git sqlite3 curl debian-keyring debian-archive-keyring apt-transport-https

if ! command -v caddy >/dev/null; then
  echo "==> Installing Caddy"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y caddy
fi

# --- Python env ---------------------------------------------------------------
echo "==> Python venv + dependencies"
cd "$APP_DIR/backend"
[ -d .venv ] || python3 -m venv .venv
.venv/bin/pip install --upgrade pip -q
.venv/bin/pip install -r requirements.txt -q

# --- backend/.env with fresh production secrets (only if missing) -------------
if [ ! -f "$APP_DIR/backend/.env" ]; then
  echo "==> Generating backend/.env with fresh secrets"
  JWT=$(.venv/bin/python -c "import secrets; print(secrets.token_urlsafe(48))")
  ENC=$(.venv/bin/python -c "import secrets; print(secrets.token_urlsafe(48))")
  REC=$(.venv/bin/python -c "import secrets; print(secrets.token_urlsafe(48))")
  cat > "$APP_DIR/backend/.env" <<EOF
ENVIRONMENT=production
APP_URL=https://$APP_DOMAIN
CORS_ORIGINS=["https://$APP_DOMAIN","https://www.$APP_DOMAIN"]

# Security secrets. BACK THIS FILE UP (password manager). Losing
# DATA_ENCRYPTION_SECRET or RECOVERY_MASTER_KEY orphans encrypted user data.
JWT_SECRET=$JWT
DATA_ENCRYPTION_SECRET=$ENC
RECOVERY_MASTER_KEY=$REC

# LLM via Ollama Cloud — paste your API key from https://ollama.com/settings/keys
OLLAMA_BASE_URL=https://ollama.com
OLLAMA_API_KEY=PASTE-YOUR-OLLAMA-KEY
LLM_MODEL=qwen3.5:9b
LLM_MODEL_REASONING=qwen3.5:9b
LLM_MODEL_FAST=qwen3.5:9b
LLM_MODEL_EXTRACTION=qwen3.5:9b
LLM_MODEL_SUMMARIZE=qwen3.5:9b

# Email (Resend) — verify your domain at https://resend.com/domains first;
# the resend.dev sandbox sender does NOT deliver to other people.
RESEND_API_KEY=PASTE-YOUR-RESEND-KEY
RESEND_FROM_EMAIL=AskPapa <noreply@$APP_DOMAIN>
EOF
  echo "!!  EDIT $APP_DIR/backend/.env — paste the Ollama and Resend API keys."
fi

# --- systemd unit + Caddyfile --------------------------------------------------
echo "==> Installing systemd unit and Caddyfile"
sed -e "s|__APP_DIR__|$APP_DIR|g" -e "s|__RUN_USER__|$RUN_USER|g" \
  "$APP_DIR/deploy/askpapa-api.service" | sudo tee /etc/systemd/system/askpapa-api.service >/dev/null
sed -e "s|__API_DOMAIN__|$API_DOMAIN|g" \
  "$APP_DIR/deploy/Caddyfile" | sudo tee /etc/caddy/Caddyfile >/dev/null

sudo systemctl daemon-reload
sudo systemctl enable --now askpapa-api
sudo systemctl restart askpapa-api
sudo systemctl enable --now caddy
sudo systemctl reload caddy || sudo systemctl restart caddy

# --- Nightly DB backup cron -----------------------------------------------------
echo "==> Installing backup cron (03:30 daily)"
chmod +x "$APP_DIR/deploy/backup-db.sh"
( crontab -l 2>/dev/null | grep -v backup-db.sh ; echo "30 3 * * * $APP_DIR/deploy/backup-db.sh >> $HOME/backups/backup.log 2>&1" ) | crontab -

echo "==> Done. Checks:"
echo "    systemctl status askpapa-api   # should be active (running)"
echo "    curl -s http://127.0.0.1:8000/health"
echo "    https://$API_DOMAIN/health     # once DNS A record points here"
