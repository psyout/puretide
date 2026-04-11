#!/usr/bin/env bash
set -euo pipefail

VPS_USER="${VPS_USER:-root}"
VPS_HOST="${VPS_HOST:-82.221.139.21}"
VPS_PATH="${VPS_PATH:-/var/www/puretide}"
PM2_APP="${PM2_APP:-puretide}"

SSH_TARGET="${VPS_USER}@${VPS_HOST}"

echo "Linting..."
npm run lint

echo "Cleaning local build cache..."
rm -rf .next

echo "Building locally..."
npm run build

if [[ ! -d .next/standalone ]]; then
  echo "Error: .next/standalone not found. Build may have failed."
  exit 1
fi

echo "Cleaning old build artifacts on VPS..."
# Stop only the managed PM2 app to reduce deploy blast radius
# Preserve data/ (orders.sqlite, optional orders.json) - only remove app artifacts
ssh "${SSH_TARGET}" "pm2 stop \"${PM2_APP}\" || true && cd \"${VPS_PATH}\" && rm -rf node_modules .next/cache .next/server .next/standalone .next/static"

echo "Syncing build artifacts to ${SSH_TARGET}:${VPS_PATH}..."
# Do NOT sync standalone's node_modules (symlinks cause rsync "No such file or directory"). Server populates node_modules via npm install below.
rsync -avz --exclude='node_modules' .next/standalone/ "${SSH_TARGET}:${VPS_PATH}/.next/standalone/"
rsync -avz .next/static/ "${SSH_TARGET}:${VPS_PATH}/.next/static/"
rsync -avz public/ "${SSH_TARGET}:${VPS_PATH}/public/"
rsync -avz package.json package-lock.json "${SSH_TARGET}:${VPS_PATH}/"

echo "Syncing static assets into standalone runtime..."
ssh "${SSH_TARGET}" "set -euo pipefail; cd \"${VPS_PATH}\"; rm -rf .next/standalone/.next/static; mkdir -p .next/standalone/.next; cp -R .next/static .next/standalone/.next/static; rm -rf .next/standalone/public; cp -R public .next/standalone/public"

echo "Installing deps on VPS (standalone node_modules are symlinks; replace with real deps)..."
ssh "${SSH_TARGET}" "cd \"${VPS_PATH}\" && rm -rf node_modules && npm install --omit=dev"

echo "Ensuring sql.js WASM exists inside standalone runtime..."
ssh "${SSH_TARGET}" "set -euo pipefail; cd \"${VPS_PATH}\"; mkdir -p .next/standalone/node_modules/sql.js/dist; cp -f node_modules/sql.js/dist/sql-wasm.wasm .next/standalone/node_modules/sql.js/dist/sql-wasm.wasm"

echo "Ensuring data directory exists on VPS..."
ssh "${SSH_TARGET}" "umask 077 && mkdir -p \"${VPS_PATH}/data\" && chmod 700 \"${VPS_PATH}/data\" && touch \"${VPS_PATH}/data/orders.sqlite\" && chmod 600 \"${VPS_PATH}/data/orders.sqlite\""
echo "Restarting pm2 app (${PM2_APP}) on VPS..."
# HOSTNAME=0.0.0.0 is the key fix for the 502 error
# ORDERS_DB_PATH ensures SQLite uses absolute path in standalone mode
ssh "${SSH_TARGET}" "set -euo pipefail; cd \"${VPS_PATH}\"; set -a; [ -f .env ] && . ./.env; set +a; HOSTNAME=0.0.0.0 ORDERS_DB_PATH=\"${VPS_PATH}/data/orders.sqlite\" pm2 restart \"${PM2_APP}\" --update-env || HOSTNAME=0.0.0.0 ORDERS_DB_PATH=\"${VPS_PATH}/data/orders.sqlite\" pm2 start .next/standalone/server.js --name \"${PM2_APP}\" --update-env --max-memory-restart 700M"

echo "Done. Website should be live at https://puretide.ca"