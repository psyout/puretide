#!/usr/bin/env bash
set -euo pipefail

VPS_USER="${VPS_USER:-root}"
VPS_HOST="${VPS_HOST:-82.221.139.21}"
VPS_PATH="${VPS_PATH:-/var/www/puretide}"
PM2_APP="${PM2_APP:-puretide}"

SSH_TARGET="${VPS_USER}@${VPS_HOST}"

echo "Building locally..."
npm run build

echo "Cleaning old build artifacts and killing ghost processes on VPS..."
# This kills anything currently holding port 3000 so PM2 can start fresh
ssh "${SSH_TARGET}" "fuser -k 3000/tcp || true && cd \"${VPS_PATH}\" && rm -rf node_modules .next/cache .next/server .next/standalone"

echo "Syncing build artifacts to ${SSH_TARGET}:${VPS_PATH}..."
rsync -avz .next/standalone/ "${SSH_TARGET}:${VPS_PATH}/"
rsync -avz .next/static/ "${SSH_TARGET}:${VPS_PATH}/.next/static/"
rsync -avz public/ "${SSH_TARGET}:${VPS_PATH}/public/"

echo "Ensuring data directory exists on VPS..."
ssh "${SSH_TARGET}" "mkdir -p \"${VPS_PATH}/data\" && chmod 755 \"${VPS_PATH}/data\""

echo "Restarting pm2 app (${PM2_APP}) on VPS..."
# HOSTNAME=0.0.0.0 is the key fix for the 502 error
ssh "${SSH_TARGET}" "cd \"${VPS_PATH}\" && HOSTNAME=0.0.0.0 pm2 restart \"${PM2_APP}\" --update-env || HOSTNAME=0.0.0.0 pm2 start server.js --name \"${PM2_APP}\" --max-memory-restart 700M"

echo "Done. Website should be live at https://puretide.ca"