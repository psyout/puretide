#!/usr/bin/env bash
set -euo pipefail

readonly APP_DIR=/var/www/puretide
readonly JOB="${1:-}"

cd "$APP_DIR"
set -a
# shellcheck disable=SC1091
source "$APP_DIR/.env"
set +a

if [[ -z "${CRON_SECRET:-}" ]]; then
	echo "$(date -Is) $JOB failed: CRON_SECRET is missing"
	exit 1
fi

echo "$(date -Is) $JOB start"
case "$JOB" in
	daily-labels|afternoon-labels)
		/usr/bin/curl --fail --show-error --silent --retry 3 --max-time 180 \
			-X POST "http://127.0.0.1:3000/api/cron/$JOB" -H "x-cron-secret: $CRON_SECRET"
		;;
	shipping-automation)
		/usr/bin/curl --fail --show-error --silent --retry 3 --max-time 180 \
			"http://127.0.0.1:3000/api/cron/shipping-automation" -H "Authorization: Bearer $CRON_SECRET"
		;;
	*)
		echo "Unknown cron job: $JOB"
		exit 2
		;;
esac
echo
echo "$(date -Is) $JOB complete"
