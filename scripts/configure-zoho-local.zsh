#!/bin/zsh

set -euo pipefail

env_file='.env.local'
temp_file=$(mktemp './.env.local.XXXXXX')
trap 'rm -f "$temp_file"' EXIT

read "zoho_organization_id?Organization ID: "
read "zoho_client_id?Client ID: "
read -s "zoho_client_secret?Client Secret: "
echo
read -s "zoho_refresh_token?Refresh token: "
echo

if [[ -f "$env_file" ]]; then
	while IFS= read -r line || [[ -n "$line" ]]; do
		case "$line" in
			ZOHO_INVENTORY_WRITE_ENABLED=*|ZOHO_INVENTORY_ORGANIZATION_ID=*|ZOHO_INVENTORY_CLIENT_ID=*|ZOHO_INVENTORY_CLIENT_SECRET=*|ZOHO_INVENTORY_REFRESH_TOKEN=*|ZOHO_ACCOUNTS_BASE_URL=*|ZOHO_INVENTORY_API_BASE_URL=*)
				continue
				;;
		esac
		print -r -- "$line" >> "$temp_file"
	done < "$env_file"
fi

{
	print -r -- ''
	print -r -- '# Zoho Inventory (local read-only test)'
	print -r -- 'ZOHO_INVENTORY_WRITE_ENABLED=false'
	print -r -- "ZOHO_INVENTORY_ORGANIZATION_ID=${zoho_organization_id}"
	print -r -- "ZOHO_INVENTORY_CLIENT_ID=${zoho_client_id}"
	print -r -- "ZOHO_INVENTORY_CLIENT_SECRET=${zoho_client_secret}"
	print -r -- "ZOHO_INVENTORY_REFRESH_TOKEN=${zoho_refresh_token}"
	print -r -- 'ZOHO_ACCOUNTS_BASE_URL=https://accounts.zohocloud.ca'
	print -r -- 'ZOHO_INVENTORY_API_BASE_URL=https://www.zohoapis.ca/inventory/v1'
} >> "$temp_file"

chmod 600 "$temp_file"
mv "$temp_file" "$env_file"
trap - EXIT
unset zoho_organization_id zoho_client_id zoho_client_secret zoho_refresh_token

echo 'Zoho Inventory was added to .env.local in read-only mode.'
