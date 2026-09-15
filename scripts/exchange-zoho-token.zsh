#!/bin/zsh

set -u

read "zoho_client_id?Client ID: "
read -s "zoho_client_secret?Client Secret: "
echo
read -s "zoho_grant_code?Generated code: "
echo

response=$(curl -sS -X POST 'https://accounts.zohocloud.ca/oauth/v2/token' \
	--data-urlencode "client_id=${zoho_client_id}" \
	--data-urlencode "client_secret=${zoho_client_secret}" \
	--data-urlencode "code=${zoho_grant_code}" \
	--data-urlencode 'grant_type=authorization_code')

unset zoho_client_id zoho_client_secret zoho_grant_code

echo "$response"

