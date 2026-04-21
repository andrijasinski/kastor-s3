#!/bin/sh
set -e

missing=""
for var in S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY S3_ENDPOINT S3_REGION; do
    eval "val=\$$var"
    if [ -z "$val" ]; then
        missing="$missing $var"
    fi
done

if [ -n "$missing" ]; then
    echo "Error: missing required environment variables:$missing" >&2
    exit 1
fi

cd /app/api
bun run src/index.ts &
BUN_PID=$!

(
    wait $BUN_PID
    echo "Bun API process exited, stopping container..." >&2
    nginx -s stop 2>/dev/null || true
) &

exec nginx -g 'daemon off;'
