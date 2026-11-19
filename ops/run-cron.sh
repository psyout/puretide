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
	daily-labels)
		# BC has stayed on UTC-7 since March 2026. Use that offset explicitly
		# because some server timezone databases still switch back in November.
		vancouver_now=$(node -e 'console.log(new Date(Date.now()-7*3600000).toISOString().slice(0,13))')
		vancouver_hour=${vancouver_now:11:2}
		if (( 10#$vancouver_hour < 6 )); then
			echo "$(date -Is) $JOB waiting until 06:00 Vancouver"
			exit 0
		fi
		vancouver_today=${vancouver_now:0:10}
		vancouver_yesterday=$(node -e 'const [y,m,d]=process.argv[1].split("-").map(Number); console.log(new Date(Date.UTC(y,m-1,d-1)).toISOString().slice(0,10))' "$vancouver_today")
		/usr/bin/curl --fail --show-error --silent --retry 3 --max-time 180 \
			-X POST "http://127.0.0.1:3000/api/cron/daily-labels?date=$vancouver_yesterday" -H "x-cron-secret: $CRON_SECRET"
		;;
	afternoon-labels)
		/usr/bin/curl --fail --show-error --silent --retry 3 --max-time 180 \
			-X POST "http://127.0.0.1:3000/api/cron/$JOB" -H "x-cron-secret: $CRON_SECRET"
		;;
	shipping-automation)
		/usr/bin/curl --fail --show-error --silent --retry 3 --max-time 180 \
			"http://127.0.0.1:3000/api/cron/shipping-automation" -H "Authorization: Bearer $CRON_SECRET"
		;;
	zoho-stock-sheet)
		/usr/bin/curl --fail --show-error --silent --retry 3 --max-time 180 \
			-X POST "http://127.0.0.1:3000/api/cron/zoho-stock-sheet" -H "x-cron-secret: $CRON_SECRET"
		;;
	etransfer-reminders)
		/usr/bin/curl --fail --show-error --silent --retry 3 --max-time 180 \
			-X POST "http://127.0.0.1:3000/api/cron/etransfer-reminders" -H "x-cron-secret: $CRON_SECRET"
		;;
	meta-conversions)
		/usr/bin/curl --fail --show-error --silent --retry 3 --max-time 180 \
			-X POST "http://127.0.0.1:3000/api/cron/meta-conversions" -H "x-cron-secret: $CRON_SECRET"
		;;
	*)
		echo "Unknown cron job: $JOB"
		exit 2
		;;
esac
echo
echo "$(date -Is) $JOB complete"
