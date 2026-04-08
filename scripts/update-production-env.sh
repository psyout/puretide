#!/usr/bin/env bash
set -euo pipefail

VPS_USER="${VPS_USER:-root}"
VPS_HOST="${VPS_HOST:-82.221.139.21}"
VPS_PATH="${VPS_PATH:-/var/www/puretide}"
PM2_APP="${PM2_APP:-puretide}"

SSH_TARGET="${VPS_USER}@${VPS_HOST}"

echo "⚠️  This will update production .env file"
echo "Press Ctrl+C to cancel, or Enter to continue..."
read

echo "Backing up current production .env..."
ssh "${SSH_TARGET}" "cd \"${VPS_PATH}\" && cp .env .env.backup.\$(date +%Y%m%d_%H%M%S)"

echo "Uploading new .env to production..."
scp .env "${SSH_TARGET}:${VPS_PATH}/.env"

echo "Restarting PM2 app to load new environment..."
ssh "${SSH_TARGET}" "pm2 restart \"${PM2_APP}\""

echo "✅ Production .env updated and app restarted"
echo "Check logs: ssh ${SSH_TARGET} 'pm2 logs ${PM2_APP}'"
