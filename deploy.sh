#!/usr/bin/env bash
set -euo pipefail

VPS_USER="${VPS_USER:-root}"
VPS_HOST="${VPS_HOST:-82.221.139.21}"
VPS_PATH="${VPS_PATH:-/var/www/puretide}"
PM2_APP="${PM2_APP:-puretide}"

SSH_TARGET="${VPS_USER}@${VPS_HOST}"

echo "Building locally..."
npm run build

echo "Cleaning old build artifacts on VPS..."
ssh "${SSH_TARGET}" "cd \"${VPS_PATH}\" && rm -rf node_modules .next/cache .next/server .next/standalone"

echo "Syncing build artifacts to ${SSH_TARGET}:${VPS_PATH}..."
rsync -avz .next/standalone/ "${SSH_TARGET}:${VPS_PATH}/"
rsync -avz .next/static/ "${SSH_TARGET}:${VPS_PATH}/.next/static/"
rsync -avz public/ "${SSH_TARGET}:${VPS_PATH}/public/"

echo "Restarting pm2 app (${PM2_APP}) on VPS..."
ssh "${SSH_TARGET}" "cd \"${VPS_PATH}\" && if pm2 describe \"${PM2_APP}\" >/dev/null 2>&1; then pm2 restart \"${PM2_APP}\" --update-env; else echo \"pm2 app '${PM2_APP}' not found. Run: pm2 list\"; exit 1; fi"

echo "Done."
