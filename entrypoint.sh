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

if [ -n "$AUTH_PASSWORD" ] && [ -z "$AUTH_USERNAME" ]; then
    echo "Error: AUTH_PASSWORD is set but AUTH_USERNAME is not" >&2
    exit 1
fi

if [ -n "$AUTH_USERNAME" ] && [ -z "$AUTH_PASSWORD" ]; then
    echo "Error: AUTH_USERNAME is set but AUTH_PASSWORD is not" >&2
    exit 1
fi

if [ -n "$AUTH_PASSWORD" ]; then
    _auth_username="$AUTH_USERNAME"
    _auth_username_clean="$(printf '%s' "$_auth_username" | tr -d ':\r\n')"
    if [ "$_auth_username_clean" != "$_auth_username" ]; then
        echo "Error: AUTH_USERNAME must not contain ':', newline, or carriage return" >&2
        exit 1
    fi
    (umask 027; printf '%s:%s\n' "$_auth_username" "$(openssl passwd -apr1 "$AUTH_PASSWORD")" > /etc/nginx/.htpasswd)
    chown root:nginx /etc/nginx/.htpasswd
    cp /etc/nginx/conf.d/nginx.conf.auth /etc/nginx/conf.d/default.conf
else
    cp /etc/nginx/conf.d/nginx.conf.noauth /etc/nginx/conf.d/default.conf
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
